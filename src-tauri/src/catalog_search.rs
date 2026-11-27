//! Search: the catalogs (YouTube Music, YouTube, Apple Music), the suggestions as one types.

use super::*;
use music_connectors::ytweb::WebVideo;
use std::sync::Arc;

/// UTC day number (mix seed).
pub fn today() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_secs() / 86_400)
}

/// YouTube Music song search, cached for the session. Signed out: its public catalog (2026-10-30: imports and
/// fallbacks found nothing without a Google sign-in).
pub async fn yt_search(state: &AppState, query: &str) -> Result<Vec<Track>, String> {
    let key = query.trim().to_lowercase();
    if let Some(hit) = state.cache.youtube.get(&key) {
        return Ok((*hit).clone());
    }
    let found = state.ytm_or_public().search_songs(query).await.map_err(err)?;
    state.cache.youtube.put(&key, found.clone());
    Ok(found)
}

#[derive(Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SearchHit {
    #[serde(flatten)]
    hit: Hit,
    /// Library row when already added.
    library_id: Option<i64>,
}

/// Normal YouTube search (session if signed in, anonymous otherwise), cached 30 min.
pub async fn video_search(state: &AppState, query: &str) -> Result<Vec<(Track, Musicness)>, String> {
    Ok(as_songs(state, &web_videos(state, query).await?))
}

/// The search's videos as YouTube gave them: read into songs at each use (`as_songs`), as more artists get known.
async fn web_videos(state: &AppState, query: &str) -> Result<Arc<Vec<WebVideo>>, String> {
    let key = query.trim().to_lowercase();
    if let Some(hit) = state.cache.videos.get(&key) {
        return Ok(hit);
    }
    let web = YouTubeWeb::with_api(hosts::get().youtube, ytm::session(&state.app).as_deref());
    let videos = web.search(query).await.map_err(err)?;
    Ok(state.cache.videos.put(&key, videos))
}

/// Videos as songs, with what kind each is. Reupload channels write "Title - Artist": the artists known tell.
fn as_songs(state: &AppState, videos: &[WebVideo]) -> Vec<(Track, Musicness)> {
    let known = state.lib().artist_keys().unwrap_or_default();
    videos
        .iter()
        .map(|video| {
            let mut track = video.track.clone();
            music_connectors::youtube::turn_round(&mut track, &video.raw_title, &video.channel, |key| known.contains(key));
            (track, video.musicness())
        })
        .collect()
}

/// A pasted or shared YouTube link as a song, its title turned round when the artists known say it was written backwards.
pub async fn youtube_link(state: &AppState, link: &str) -> anyhow::Result<Track> {
    // Unread, the title is taken as written: the song comes all the same.
    let known = state.lib().artist_keys().unwrap_or_default();
    music_connectors::youtube::track_from_link(link, music_connectors::youtube::OEMBED, |key| known.contains(key)).await
}

#[derive(Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SearchResults {
    hits: Vec<SearchHit>,
    errors: Vec<String>,
}

/// Trust boundary: ISO 3166 store code from UI locale.
pub fn store(country: &str) -> String {
    if country.len() == 2 && country.chars().all(|c| c.is_ascii_alphabetic()) { country.to_uppercase() } else { "US".into() }
}

/// Normal YouTube + YouTube Music songs + Apple catalog, merged (same recording = one hit with every id). Each hit says
/// whether it looks like music; the UI hides the clear "not music" ones until asked.
#[tauri::command]
pub async fn search_catalogs(state: State<'_, AppState>, query: String, country: String) -> CmdResult<SearchResults> {
    // Trust boundary: free text from UI.
    let query = query.trim().to_string();
    if query.is_empty() || query.chars().count() > 200 {
        return Err("Search: 1 to 200 characters".into());
    }
    let country = store(&country);
    let apple_key = format!("{country}:{}", query.to_lowercase());
    let known = state.cache.apple.get(&apple_key);
    let apple = tauri::async_runtime::spawn({
        let q = query.clone();
        async move {
            match known {
                Some(hit) => Ok((*hit).clone()),
                None => music_connectors::itunes::search(hosts::get().itunes, &q, &country).await,
            }
        }
    });
    let mut errors = Vec::new();
    let (videos, songs) = tokio::join!(web_videos(&state, &query), yt_search(&state, &query));
    // Read once the songs are in: their artists tell too.
    let videos = videos.map(|videos| as_songs(&state, &videos));
    let videos = videos.unwrap_or_else(|e| {
        errors.push(format!("YouTube: {e}"));
        Vec::new()
    });
    let songs = songs.unwrap_or_else(|e| {
        errors.push(format!("YouTube Music: {e}"));
        Vec::new()
    });
    let apple = match apple.await.map_err(err)? {
        Ok(found) => {
            state.cache.apple.put(&apple_key, found.clone());
            found
        }
        Err(e) => {
            errors.push(format!("Apple Music: {}", err(e)));
            Vec::new()
        }
    };
    let lib = state.lib();
    let hits = search::merge(videos, songs, apple).into_iter().map(|hit| SearchHit { library_id: lib.find(&hit.track).ok().flatten(), hit }).collect();
    Ok(SearchResults { hits, errors })
}

/// What YouTube's search box would suggest for this text (top bar, as you type; off in Settings › General).
#[tauri::command]
pub async fn search_suggestions(query: String, lang: String, country: String) -> CmdResult<Vec<String>> {
    // Trust boundary: free text from UI.
    let query = query.trim();
    if query.is_empty() || query.chars().count() > 100 {
        return Ok(Vec::new());
    }
    let lang = if lang.len() == 2 && lang.bytes().all(|b| b.is_ascii_lowercase()) { lang } else { "en".into() };
    music_connectors::ytweb::suggestions(hosts::get().suggest, query, &lang, &store(&country)).await.map_err(err)
}
