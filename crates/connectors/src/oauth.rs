use anyhow::{Context, Result, anyhow, bail};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use music_core::model::SecretStore;
use reqwest::Method;
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::mpsc::UnboundedReceiver;
use url::{Url, form_urlencoded};

/// Opens URL in user's browser.
pub type Opener = Arc<dyn Fn(&str) -> Result<()> + Send + Sync>;

pub struct OAuthConfig {
    /// SecretStore key for tokens.
    pub key: &'static str,
    pub auth_url: String,
    pub token_url: String,
    pub client_id: String,
    /// Google Desktop clients need it (not really secret, RFC 8252). Spotify PKCE: none.
    pub client_secret: Option<String>,
    pub scope: &'static str,
    pub extra_auth_params: &'static [(&'static str, &'static str)],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    /// Epoch ms.
    pub expires_at: u64,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64
}

/// How long a sign-in waits for the user's answer.
pub const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(300);

/// A sign-in's own `state`: an answer without it is not its answer.
fn new_state() -> String {
    URL_SAFE_NO_PAD.encode(rand::random::<[u8; 16]>())
}

/// What an authorization answer says: the `name` it carries along with this sign-in's `state`, else why not.
fn answered(answer: &Url, name: &str, state: &str) -> Result<String> {
    let query: HashMap<String, String> = answer.query_pairs().into_owned().collect();
    let value = query.get(name).filter(|_| query.get("state").is_some_and(|given| given == state));
    value.cloned().ok_or_else(|| anyhow!(query.get("error").cloned().unwrap_or_else(|| "Invalid OAuth response".into())))
}

/// `link` as this sign-in's answer: the redirect address with its `state`. None: another link, or another sign-in's.
fn answer_to(link: &str, redirect: &str, state: &str) -> Option<Url> {
    let rest = link.strip_prefix(redirect)?;
    if !(rest.starts_with('?') || rest.starts_with("/?")) {
        return None;
    }
    let answer = Url::parse(link).ok()?;
    answer.query_pairs().any(|(name, value)| name == "state" && value == state).then_some(answer)
}

pub fn pkce() -> (String, String) {
    let verifier = URL_SAFE_NO_PAD.encode(rand::random::<[u8; 32]>());
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    (verifier, challenge)
}

/// Open auth URL, wait redirect on http://127.0.0.1:<free port>/callback. Dynamic loopback port OK for Spotify + Google.
pub async fn loopback_authorize(
    build_url: impl FnOnce(&str, &str) -> String,
    open: impl FnOnce(&str) -> Result<()>,
    timeout: Duration,
) -> Result<(String, String)> {
    loopback_param("code", build_url, open, timeout).await
}

/// Same loopback, any answer name: OAuth's `code`, Last.fm's `token` (its callback keeps our `state` query).
pub async fn loopback_param(
    name: &str,
    build_url: impl FnOnce(&str, &str) -> String,
    open: impl FnOnce(&str) -> Result<()>,
    timeout: Duration,
) -> Result<(String, String)> {
    loopback_on(0, name, build_url, open, timeout).await
}

/// Same, on a given port (0 = any free one). Discord only takes a redirect address registered whole, port included.
pub async fn loopback_on(
    port: u16,
    name: &str,
    build_url: impl FnOnce(&str, &str) -> String,
    open: impl FnOnce(&str) -> Result<()>,
    timeout: Duration,
) -> Result<(String, String)> {
    let state = new_state();
    let listener = TcpListener::bind(("127.0.0.1", port)).await.with_context(|| format!("Port {port} is busy: close what uses it and try again"))?;
    let redirect = format!("http://127.0.0.1:{}/callback", listener.local_addr()?.port());
    open(&build_url(&redirect, &state))?;
    tokio::time::timeout(timeout, async {
        loop {
            let (mut sock, _) = listener.accept().await?;
            let mut buf = vec![0u8; 8192];
            // shortcut: request line assumed in first read. Fine for browsers on loopback.
            let n = sock.read(&mut buf).await?;
            let req = String::from_utf8_lossy(&buf[..n]);
            let url = Url::parse(&format!("http://127.0.0.1{}", req.split_whitespace().nth(1).unwrap_or("/")))?;
            if url.path() != "/callback" {
                sock.write_all(b"HTTP/1.1 404 Not Found\r\ncontent-length: 0\r\nconnection: close\r\n\r\n").await?;
                continue;
            }
            let code = answered(&url, name, &state);
            let (status, body) = match code {
                Ok(_) => ("200 OK", "<p>Account connected. You can close this tab.</p>"),
                Err(_) => ("400 Bad Request", "<p>Connection failed.</p>"),
            };
            let head = format!("HTTP/1.1 {status}\r\ncontent-type: text/html; charset=utf-8\r\ncontent-length: {}\r\nconnection: close\r\n\r\n", body.len());
            sock.write_all(format!("{head}{body}").as_bytes()).await?;
            return code.map(|code| (code, redirect));
        }
    })
    .await
    .context("Sign-in timed out")?
}

/// Shared OAuth 2 client (code + PKCE): connect, refresh, authed calls.
pub struct OAuthClient {
    cfg: OAuthConfig,
    store: Arc<dyn SecretStore>,
    open: Opener,
    http: reqwest::Client,
}

impl OAuthClient {
    pub fn new(cfg: OAuthConfig, store: Arc<dyn SecretStore>, open: Opener) -> Self {
        Self { cfg, store, open, http: crate::http() }
    }

    pub fn is_connected(&self) -> bool {
        self.store.get(self.cfg.key).is_some()
    }

    pub fn disconnect(&self) -> Result<()> {
        self.store.set(self.cfg.key, None)
    }

    pub async fn connect(&self) -> Result<()> {
        self.connect_on(0).await
    }

    /// `connect` with the callback on a fixed port (0 = any).
    pub async fn connect_on(&self, port: u16) -> Result<()> {
        let (verifier, challenge) = pkce();
        let (code, redirect) = loopback_on(port, "code", |redirect, state| self.authorize_url(redirect, state, &challenge), |url| (self.open)(url), SIGN_IN_TIMEOUT).await?;
        self.exchange(&code, &redirect, &verifier).await
    }

    /// `connect` whose answer comes back as a link to the app itself (`redirect`, a phone's): `answers` brings the links
    /// the system opens the app with. Any but this sign-in's answer is waited past.
    pub async fn connect_by_link(&self, redirect: &str, mut answers: UnboundedReceiver<String>, timeout: Duration) -> Result<()> {
        let (verifier, challenge) = pkce();
        let state = new_state();
        (self.open)(&self.authorize_url(redirect, &state, &challenge))?;
        let code = tokio::time::timeout(timeout, async {
            loop {
                let link = answers.recv().await.context("Another sign-in was started")?;
                if let Some(answer) = answer_to(&link, redirect, &state) {
                    return answered(&answer, "code", &state);
                }
            }
        })
        .await
        .context("Sign-in timed out")??;
        self.exchange(&code, redirect, &verifier).await
    }

    /// The provider's page where the user allows the app.
    fn authorize_url(&self, redirect: &str, state: &str, challenge: &str) -> String {
        let mut url = Url::parse(&self.cfg.auth_url).expect("static auth url");
        url.query_pairs_mut()
            .extend_pairs([
                ("client_id", self.cfg.client_id.as_str()),
                ("response_type", "code"),
                ("redirect_uri", redirect),
                ("state", state),
                ("scope", self.cfg.scope),
                ("code_challenge_method", "S256"),
                ("code_challenge", challenge),
            ])
            .extend_pairs(self.cfg.extra_auth_params);
        url.into()
    }

    /// The answer's code for tokens, kept in the store.
    async fn exchange(&self, code: &str, redirect: &str, verifier: &str) -> Result<()> {
        let params = [("grant_type", "authorization_code"), ("code", code), ("redirect_uri", redirect), ("code_verifier", verifier)];
        self.token_request(&params, None).await.map(drop)
    }

    pub async fn access_token(&self) -> Result<String> {
        let key = self.cfg.key;
        let t: OAuthTokens = self.store.load(key).ok_or_else(|| anyhow!("Not connected ({key})"))?;
        if now_ms() < t.expires_at {
            return Ok(t.access_token);
        }
        let refresh = t.refresh_token.clone().ok_or_else(|| anyhow!("Session expired ({key}), reconnect the account"))?;
        Ok(self.token_request(&[("grant_type", "refresh_token"), ("refresh_token", &refresh)], Some(&t)).await?.access_token)
    }

    /// Authed JSON call. Honor Retry-After on 429, once, capped 30 s. Empty body → null.
    pub async fn json<T: DeserializeOwned>(&self, method: Method, url: &str, body: Option<&serde_json::Value>) -> Result<T> {
        let mut retried = false;
        loop {
            let mut req = self.http.request(method.clone(), url).bearer_auth(self.access_token().await?);
            if let Some(b) = body {
                req = req.json(b);
            }
            let res = req.send().await?;
            let status = res.status();
            if status == 429 && !retried {
                let wait = res.headers().get("retry-after").and_then(|v| v.to_str().ok()?.parse().ok()).unwrap_or(1u64);
                tokio::time::sleep(Duration::from_secs(wait.min(30))).await;
                retried = true;
                continue;
            }
            if !status.is_success() {
                bail!("{method} {url} → {status} {}", res.text().await.unwrap_or_default());
            }
            let bytes = res.bytes().await?;
            return Ok(serde_json::from_slice(if bytes.is_empty() { b"null" } else { &bytes })?);
        }
    }

    async fn token_request(&self, params: &[(&str, &str)], prev: Option<&OAuthTokens>) -> Result<OAuthTokens> {
        // Serializer is !Send: finish before any await.
        let body = {
            let mut form = form_urlencoded::Serializer::new(String::new());
            form.extend_pairs(params).append_pair("client_id", &self.cfg.client_id);
            if let Some(secret) = &self.cfg.client_secret {
                form.append_pair("client_secret", secret);
            }
            form.finish()
        };
        let res = self
            .http
            .post(&self.cfg.token_url)
            .header("content-type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await?;
        let status = res.status();
        if !status.is_success() {
            bail!("Token exchange refused: {status} {}", res.text().await.unwrap_or_default());
        }
        #[derive(Deserialize)]
        struct Resp {
            access_token: String,
            refresh_token: Option<String>,
            expires_in: u64,
        }
        let r: Resp = res.json().await?;
        let tokens = OAuthTokens {
            access_token: r.access_token,
            // Spotify may rotate refresh token. Google never resends it.
            refresh_token: r.refresh_token.or_else(|| prev.and_then(|p| p.refresh_token.clone())),
            expires_at: now_ms() + r.expires_in.saturating_sub(60) * 1000,
        };
        self.store.save(self.cfg.key, &tokens)?;
        Ok(tokens)
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use mockito::Matcher;
    use music_core::model::MemoryStore;
    use serde_json::json;

    pub fn valid_store(key: &str) -> Arc<dyn SecretStore> {
        Arc::new(MemoryStore::with(key, json!({ "accessToken": "AT", "refreshToken": "RT", "expiresAt": u64::MAX })))
    }

    pub fn no_open() -> Opener {
        Arc::new(|_| Ok(()))
    }

    // Fake browser: user approves (or not), provider redirects to loopback.
    fn browser(code: Option<&'static str>, forge_state: bool) -> impl FnOnce(&str) -> Result<()> {
        move |url: &str| {
            let u = Url::parse(url)?;
            let q: HashMap<String, String> = u.query_pairs().into_owned().collect();
            let mut back = Url::parse(&q["redirect_uri"])?;
            match code {
                Some(c) => back.query_pairs_mut().append_pair("code", c).append_pair("state", if forge_state { "forged" } else { &q["state"] }),
                None => back.query_pairs_mut().append_pair("error", "access_denied"),
            };
            tokio::spawn(crate::http().get(back.to_string()).send());
            Ok(())
        }
    }

    fn auth_url(redirect: &str, state: &str) -> String {
        let mut u = Url::parse("https://x/").unwrap();
        u.query_pairs_mut().append_pair("redirect_uri", redirect).append_pair("state", state);
        u.into()
    }

    #[test]
    fn pkce_challenge_is_sha256_of_verifier() {
        let (v, c) = pkce();
        assert_eq!(v.len(), 43);
        assert_eq!(c, URL_SAFE_NO_PAD.encode(Sha256::digest(v.as_bytes())));
    }

    #[tokio::test]
    async fn loopback_receives_code_on_dynamic_port() {
        let (code, redirect) = loopback_authorize(auth_url, browser(Some("C1"), false), Duration::from_secs(5)).await.unwrap();
        assert_eq!(code, "C1");
        assert!(redirect.starts_with("http://127.0.0.1:") && redirect.ends_with("/callback"));
    }

    #[tokio::test]
    async fn loopback_rejects_forged_state_and_denial() {
        assert!(loopback_authorize(auth_url, browser(Some("C"), true), Duration::from_secs(5)).await.is_err());
        let err = loopback_authorize(auth_url, browser(None, false), Duration::from_secs(5)).await.unwrap_err();
        assert!(err.to_string().contains("access_denied"));
    }

    fn cfg(server: &mockito::Server, secret: Option<&str>) -> OAuthConfig {
        OAuthConfig {
            key: "svc",
            auth_url: format!("{}/authorize", server.url()),
            token_url: format!("{}/token", server.url()),
            client_id: "CID".into(),
            client_secret: secret.map(Into::into),
            scope: "read",
            extra_auth_params: &[],
        }
    }

    #[tokio::test]
    async fn connect_exchanges_code_with_pkce_verifier() {
        let mut server = mockito::Server::new_async().await;
        let token = server
            .mock("POST", "/token")
            .match_body(Matcher::AllOf(vec![
                Matcher::UrlEncoded("grant_type".into(), "authorization_code".into()),
                Matcher::UrlEncoded("code".into(), "CODE".into()),
                Matcher::UrlEncoded("client_id".into(), "CID".into()),
                Matcher::Regex("code_verifier=[\\w-]{43}".into()),
            ]))
            .with_body(r#"{"access_token":"AT","refresh_token":"RT","expires_in":3600}"#)
            .create_async()
            .await;
        let store: Arc<dyn SecretStore> = Arc::new(MemoryStore::default());
        let open = browser(Some("CODE"), false);
        let open = std::sync::Mutex::new(Some(open));
        let opener: Opener = Arc::new(move |u| open.lock().unwrap().take().unwrap()(u));
        OAuthClient::new(cfg(&server, None), store.clone(), opener).connect().await.unwrap();
        token.assert_async().await;
        let saved: OAuthTokens = store.load("svc").unwrap();
        assert_eq!((saved.access_token.as_str(), saved.refresh_token.as_deref()), ("AT", Some("RT")));
    }

    /// A phone's browser: reads the page asked for, then opens links back (`answers` them with the page's own state).
    fn phone_browser(links: fn(&str) -> Vec<String>) -> (Opener, UnboundedReceiver<String>) {
        let (sender, receiver) = tokio::sync::mpsc::unbounded_channel();
        let opener: Opener = Arc::new(move |page| {
            let query: HashMap<String, String> = Url::parse(page)?.query_pairs().into_owned().collect();
            assert_eq!(query["redirect_uri"], "legato://spotify-callback");
            assert_eq!(query["code_challenge_method"], "S256");
            for link in links(&query["state"]) {
                sender.send(link)?;
            }
            Ok(())
        });
        (opener, receiver)
    }

    #[tokio::test]
    async fn a_link_back_to_the_app_signs_in_with_the_same_exchange() {
        let mut server = mockito::Server::new_async().await;
        let token = server
            .mock("POST", "/token")
            .match_body(Matcher::AllOf(vec![
                Matcher::UrlEncoded("code".into(), "CODE".into()),
                Matcher::UrlEncoded("redirect_uri".into(), "legato://spotify-callback".into()),
                Matcher::Regex("code_verifier=[\\w-]{43}".into()),
            ]))
            .with_body(r#"{"access_token":"AT","refresh_token":"RT","expires_in":3600}"#)
            .create_async()
            .await;
        // Another app's link, another sign-in's answer and a look-alike address are waited past.
        let (opener, answers) = phone_browser(|state| {
            vec![
                "legato://spotify-callback?code=OTHER&state=old".into(),
                format!("legato://spotify-callback.example?code=OTHER&state={state}"),
                format!("legato://spotify-callback?code=CODE&state={state}"),
            ]
        });
        let store: Arc<dyn SecretStore> = Arc::new(MemoryStore::default());
        let client = OAuthClient::new(cfg(&server, None), store.clone(), opener);
        client.connect_by_link("legato://spotify-callback", answers, Duration::from_secs(5)).await.unwrap();
        token.assert_async().await;
        assert_eq!(store.load::<OAuthTokens>("svc").unwrap().access_token, "AT");
    }

    #[tokio::test]
    async fn a_refusal_by_link_fails_the_sign_in_and_silence_times_out() {
        let server = mockito::Server::new_async().await;
        let store: Arc<dyn SecretStore> = Arc::new(MemoryStore::default());
        let (opener, answers) = phone_browser(|state| vec![format!("legato://spotify-callback?error=access_denied&state={state}")]);
        let refused = OAuthClient::new(cfg(&server, None), store.clone(), opener).connect_by_link("legato://spotify-callback", answers, Duration::from_secs(5)).await;
        assert_eq!(refused.unwrap_err().to_string(), "access_denied");
        let (opener, answers) = phone_browser(|_| vec![]);
        // The browser keeps the sending end: nothing comes, until the time is up.
        let client = OAuthClient::new(cfg(&server, None), store.clone(), opener);
        let silent = client.connect_by_link("legato://spotify-callback", answers, Duration::from_millis(50)).await;
        assert_eq!(silent.unwrap_err().to_string(), "Sign-in timed out");
        assert!(store.get("svc").is_none());
    }

    #[tokio::test]
    async fn refreshes_expired_token_and_keeps_refresh_token() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/token")
            .match_body(Matcher::AllOf(vec![
                Matcher::UrlEncoded("grant_type".into(), "refresh_token".into()),
                Matcher::UrlEncoded("refresh_token".into(), "RT".into()),
                Matcher::UrlEncoded("client_secret".into(), "S".into()),
            ]))
            .with_body(r#"{"access_token":"NEW","expires_in":3600}"#)
            .create_async()
            .await;
        let store: Arc<dyn SecretStore> = Arc::new(MemoryStore::with("svc", json!({ "accessToken": "OLD", "refreshToken": "RT", "expiresAt": 0 })));
        let client = OAuthClient::new(cfg(&server, Some("S")), store.clone(), no_open());
        assert_eq!(client.access_token().await.unwrap(), "NEW");
        assert_eq!(store.load::<OAuthTokens>("svc").unwrap().refresh_token.as_deref(), Some("RT"));
    }

    #[tokio::test]
    async fn retries_once_after_429() {
        let mut server = mockito::Server::new_async().await;
        // Mockito serves first unsatisfied match: 429 once, then success.
        let limited = server.mock("GET", "/x").with_status(429).with_header("retry-after", "0").expect(1).create_async().await;
        server.mock("GET", "/x").with_body(r#"{"ok":1}"#).create_async().await;
        let client = OAuthClient::new(cfg(&server, None), valid_store("svc"), no_open());
        let res: serde_json::Value = client.json(Method::GET, &format!("{}/x", server.url()), None).await.unwrap();
        assert_eq!(res, json!({ "ok": 1 }));
        limited.assert_async().await;
    }
}
