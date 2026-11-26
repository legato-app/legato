//! While a blind test is open, plugins learn nothing of what plays: it would give the answer away (a Discord presence
//! most of all). Events that tell it are dropped and the calls that read it (the history too) answer empty.

use serde_json::{Value, json};

/// An event that names the song or follows it.
pub fn hides_event(name: &str) -> bool {
    matches!(name, "track" | "playing" | "seek" | "queue" | "ended")
}

/// What a call reading the player or the history answers meanwhile: as with nothing. None: the call goes through.
pub fn blank_answer(method: &str) -> Option<Value> {
    match method {
        "player.state" => Some(json!({ "track": null, "playing": false, "positionMs": 0, "durationMs": null, "volume": 0 })),
        "player.queue" => Some(json!({ "index": -1, "tracks": [] })),
        "history.recent" => Some(json!([])),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::perms::{EVENTS, METHODS};

    #[test]
    fn a_quiz_sends_no_event_of_the_song_and_answers_an_empty_player() {
        let heard: Vec<&str> = EVENTS.iter().map(|(name, _)| *name).filter(|name| !hides_event(name)).collect();
        assert_eq!(heard, ["volume", "command", "panel", "visualizer"]);
        let blanked: Vec<&str> = METHODS.iter().map(|(method, _, _)| *method).filter(|method| blank_answer(method).is_some()).collect();
        assert_eq!(blanked, ["player.state", "player.queue", "history.recent"]);
        let state = blank_answer("player.state").unwrap();
        assert!(state["track"].is_null() && state["playing"] == false);
    }
}
