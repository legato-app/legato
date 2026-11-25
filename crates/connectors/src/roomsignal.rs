//! Listening rooms over the internet, the meeting (`docs/rooms.md` › Over the internet): the listener's WebRTC offer and
//! the host's answer, each sealed with a key from the room's id and code, swapped once through public Nostr relays.
//! Ephemeral events (relays pass them on, never keep them), tagged with a hash of the room's id, signed with a key made
//! for each meeting. The relays see that tag, both public addresses and the times; never the id, the code, an offer,
//! songs, names or reactions. The room's own wire (SPAKE2 on the code, sealed frames) then runs inside the data channel.

use anyhow::{Result, anyhow, bail};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{ChaCha20Poly1305, Nonce};
use futures_util::{SinkExt, StreamExt};
use k256::schnorr::SigningKey;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::time::Duration;
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::time::{Instant, timeout_at};
use tokio_tungstenite::WebSocketStream;
use tokio_tungstenite::tungstenite::Message;

/// The public relays both sides use (the owner's choice, 2026-11-07).
pub const RELAYS: [&str; 2] = ["relay.damus.io", "nos.lol"];
/// An ephemeral kind (20000-29999): relays forward it to whoever listens, store nothing.
const KIND: u64 = 25_473;
/// A listener waits this long for the host's answer.
pub const WAIT: Duration = Duration::from_secs(30);
/// An offer or answer larger than this is not one (an SDP is a few KB).
const MAX: usize = 16 * 1024;

/// What both sides know: the room's random id (16 hex) and its 6-digit code (the invite link carries both).
#[derive(Debug, Clone)]
pub struct Invite {
    pub id: String,
    pub code: String,
}

impl Invite {
    /// What the relays see of the room: a hash of its id, never the id.
    pub fn tag(&self) -> String {
        hex::encode(&Sha256::new().chain_update(b"legato-room-tag-v1").chain_update(self.id.as_bytes()).finalize()[..16])
    }

    fn cipher(&self) -> ChaCha20Poly1305 {
        let key = Sha256::new().chain_update(b"legato-room-offer-v1").chain_update(self.id.as_bytes()).chain_update(b"\0").chain_update(self.code.as_bytes()).finalize();
        ChaCha20Poly1305::new_from_slice(&key[..]).expect("32 bytes")
    }

    /// A random nonce then the sealed text, in base64; `what` (offer or answer) bound in, so one can't pass for the other.
    fn seal(&self, what: &[u8], plain: &str) -> String {
        let n: [u8; 12] = rand::random();
        let sealed = self.cipher().encrypt(&Nonce::from(n), chacha20poly1305::aead::Payload { msg: plain.as_bytes(), aad: what }).expect("seal");
        B64.encode([&n[..], &sealed].concat())
    }

    /// None: not sealed with this room's id and code (another room, a wrong code, noise).
    fn open(&self, what: &[u8], text: &str) -> Option<String> {
        let raw = B64.decode(text).ok()?;
        if raw.len() < 12 || raw.len() > MAX + 28 {
            return None;
        }
        let (n, sealed) = raw.split_at(12);
        let n: [u8; 12] = n.try_into().ok()?;
        String::from_utf8(self.cipher().decrypt(&Nonce::from(n), chacha20poly1305::aead::Payload { msg: sealed, aad: what }).ok()?).ok()
    }
}

/// A signed Nostr event (NIP-01): id = SHA-256 of [0, pubkey, created_at, kind, tags, content], sig = BIP-340 on the id.
fn event(key: &SigningKey, created_at: u64, tags: Value, content: &str) -> Value {
    let pubkey = hex::encode(key.verifying_key().to_bytes());
    let id: [u8; 32] = Sha256::digest(json!([0, pubkey, created_at, KIND, tags, content]).to_string().as_bytes()).into();
    let sig = key.sign_raw(&id, &rand::random()).expect("sign");
    json!({ "id": hex::encode(id), "pubkey": pubkey, "created_at": created_at, "kind": KIND, "tags": tags, "content": content, "sig": hex::encode(sig.to_bytes()) })
}

fn new_key() -> SigningKey {
    loop {
        if let Ok(k) = SigningKey::from_bytes(&rand::random::<[u8; 32]>().into()) {
            return k;
        }
    }
}

fn now_s() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_secs())
}

/// One relay connection, its messages as JSON arrays.
pub struct Relay<S> {
    ws: WebSocketStream<S>,
}

/// The relay said no (`OK` false, `CLOSED`): the meeting ends there, never tried elsewhere sooner.
#[derive(Debug)]
pub struct Refused(pub String);

impl std::fmt::Display for Refused {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "The relay refused: {}", self.0)
    }
}

impl std::error::Error for Refused {}

/// A relay over wss: its name noted (Settings › Privacy) and resolved like every host the app reaches, TLS on rustls with
/// Mozilla's roots (every platform).
pub async fn connect(host: &str) -> Result<Relay<tokio_rustls::client::TlsStream<tokio::net::TcpStream>>> {
    music_core::netlog::note(host, music_core::netlog::Via::App, false);
    let tcp = tokio::time::timeout(Duration::from_secs(10), tokio::net::TcpStream::connect((host, 443))).await.map_err(|_| anyhow!("Unreachable"))??;
    let roots = rustls::RootCertStore::from_iter(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
    let config = rustls::ClientConfig::builder_with_provider(std::sync::Arc::new(rustls::crypto::ring::default_provider()))
        .with_safe_default_protocol_versions()?
        .with_root_certificates(roots)
        .with_no_client_auth();
    let name = rustls::pki_types::ServerName::try_from(host.to_string())?;
    let tls = tokio_rustls::TlsConnector::from(std::sync::Arc::new(config)).connect(name, tcp).await?;
    Relay::over(tls, host).await
}

impl<S: AsyncRead + AsyncWrite + Unpin> Relay<S> {
    /// Over a stream already open (TLS to the relay, or a test's socket).
    pub async fn over(stream: S, host: &str) -> Result<Relay<S>> {
        let (ws, _) = tokio_tungstenite::client_async(format!("wss://{host}/"), stream).await?;
        Ok(Relay { ws })
    }

    async fn send(&mut self, v: Value) -> Result<()> {
        Ok(self.ws.send(Message::Text(v.to_string().into())).await?)
    }

    /// The next message, by `end`. A refusal is an error; a notice or an unreadable frame is skipped.
    async fn next(&mut self, end: Instant) -> Result<Vec<Value>> {
        loop {
            let m = timeout_at(end, self.ws.next()).await.map_err(|_| anyhow!("No answer from the room"))?.ok_or_else(|| anyhow!("The relay closed"))??;
            let Message::Text(t) = m else { continue };
            if t.len() > 4 * MAX {
                continue;
            }
            let Ok(Value::Array(a)) = serde_json::from_str::<Value>(&t) else { continue };
            match a.first().and_then(Value::as_str) {
                Some("OK") if a.get(2) == Some(&Value::Bool(false)) => bail!(Refused(a.get(3).and_then(Value::as_str).unwrap_or("").chars().take(200).collect())),
                Some("CLOSED") => bail!(Refused(a.get(2).and_then(Value::as_str).unwrap_or("").chars().take(200).collect())),
                Some("EVENT") => return Ok(a),
                _ => {}
            }
        }
    }

    /// Events of this kind and `filter` from now on, on subscription `sub`.
    async fn subscribe(&mut self, sub: &str, filter: Value) -> Result<()> {
        let mut f = filter;
        f["kinds"] = json!([KIND]);
        f["since"] = json!(now_s().saturating_sub(10));
        self.send(json!(["REQ", sub, f])).await
    }
}

/// The listener's side: sends its offer, waits for the host's answer (`WAIT`). The SDP comes back opened.
pub async fn ask<S: AsyncRead + AsyncWrite + Unpin>(relay: &mut Relay<S>, invite: &Invite, offer: &str) -> Result<String> {
    ask_by(relay, invite, offer, Instant::now() + WAIT).await
}

async fn ask_by<S: AsyncRead + AsyncWrite + Unpin>(relay: &mut Relay<S>, invite: &Invite, offer: &str, end: Instant) -> Result<String> {
    let key = new_key();
    let ev = event(&key, now_s(), json!([["t", invite.tag()]]), &invite.seal(b"offer", offer));
    // Answers to this offer only: they name it.
    relay.subscribe("a", json!({ "#e": [ev["id"]] })).await?;
    relay.send(json!(["EVENT", ev])).await?;
    loop {
        let a = relay.next(end).await?;
        if let Some(sdp) = a.get(2).and_then(|e| e["content"].as_str()).and_then(|c| invite.open(b"answer", c)) {
            return Ok(sdp);
        }
    }
}

/// An offer the host heard, and how to answer it.
pub struct Offer {
    pub sdp: String,
    event: String,
}

/// The host's side: listens for the room's offers until dropped.
pub struct Listening<S> {
    relay: Relay<S>,
    invite: Invite,
    key: SigningKey,
}

impl<S: AsyncRead + AsyncWrite + Unpin> Listening<S> {
    pub async fn start(mut relay: Relay<S>, invite: Invite) -> Result<Listening<S>> {
        relay.subscribe("o", json!({ "#t": [invite.tag()] })).await?;
        Ok(Listening { relay, invite, key: new_key() })
    }

    /// The next offer sealed with this room's id and code (others skipped), by `end`.
    pub async fn next(&mut self, end: Instant) -> Result<Offer> {
        loop {
            let a = self.relay.next(end).await?;
            let Some(e) = a.get(2) else { continue };
            if let (Some(sdp), Some(id)) = (e["content"].as_str().and_then(|c| self.invite.open(b"offer", c)), e["id"].as_str()) {
                return Ok(Offer { sdp, event: id.to_string() });
            }
        }
    }

    pub async fn answer(&mut self, offer: &Offer, sdp: &str) -> Result<()> {
        let ev = event(&self.key, now_s(), json!([["t", self.invite.tag()], ["e", offer.event]]), &self.invite.seal(b"answer", sdp));
        self.relay.send(json!(["EVENT", ev])).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use k256::schnorr::{Signature, VerifyingKey};
    use tokio::net::{TcpListener, TcpStream};

    /// A relay on this machine: forwards each event to the subscriptions whose `#t` or `#e` it carries, says OK, or
    /// refuses every event when `refuse`.
    async fn mock_relay(refuse: bool) -> std::net::SocketAddr {
        let l = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = l.local_addr().unwrap();
        let (tx, _) = tokio::sync::broadcast::channel::<Value>(16);
        tokio::spawn(async move {
            while let Ok((s, _)) = l.accept().await {
                let tx = tx.clone();
                tokio::spawn(async move {
                    let mut ws = tokio_tungstenite::accept_async(s).await.unwrap();
                    let mut rx = tx.subscribe();
                    let mut subs: Vec<(String, Value)> = Vec::new();
                    loop {
                        tokio::select! {
                            m = ws.next() => {
                                let Some(Ok(Message::Text(t))) = m else { break };
                                let a: Vec<Value> = serde_json::from_str(&t).unwrap();
                                match a[0].as_str().unwrap() {
                                    "REQ" => subs.push((a[1].as_str().unwrap().into(), a[2].clone())),
                                    "EVENT" if refuse => { ws.send(Message::Text(json!(["OK", a[1]["id"], false, "blocked: no"]).to_string().into())).await.unwrap(); }
                                    "EVENT" => {
                                        ws.send(Message::Text(json!(["OK", a[1]["id"], true, ""]).to_string().into())).await.unwrap();
                                        let _ = tx.send(a[1].clone());
                                    }
                                    _ => {}
                                }
                            }
                            Ok(e) = rx.recv() => {
                                for (sub, f) in &subs {
                                    // A tag [k, v] matches a filter "#k" that lists v.
                                    if e["tags"].as_array().unwrap().iter().any(|t| f[format!("#{}", t[0].as_str().unwrap())].as_array().is_some_and(|w| w.contains(&t[1]))) {
                                        ws.send(Message::Text(json!(["EVENT", sub, e]).to_string().into())).await.unwrap();
                                    }
                                }
                            }
                        }
                    }
                });
            }
        });
        addr
    }

    async fn relay(addr: std::net::SocketAddr) -> Relay<TcpStream> {
        Relay::over(TcpStream::connect(addr).await.unwrap(), "relay.test").await.unwrap()
    }

    fn room(code: &str) -> Invite {
        Invite { id: "0123456789abcdef".into(), code: code.into() }
    }

    #[tokio::test]
    async fn an_offer_and_its_answer_meet_through_the_relay_sealed() {
        let addr = mock_relay(false).await;
        let mut host = Listening::start(relay(addr).await, room("123456")).await.unwrap();
        let host_side = tokio::spawn(async move {
            let offer = host.next(Instant::now() + Duration::from_secs(5)).await.unwrap();
            assert_eq!(offer.sdp, "v=0 offer");
            host.answer(&offer, "v=0 answer").await.unwrap();
        });
        tokio::time::sleep(Duration::from_millis(100)).await;
        let got = ask(&mut relay(addr).await, &room("123456"), "v=0 offer").await.unwrap();
        assert_eq!(got, "v=0 answer");
        host_side.await.unwrap();
    }

    #[tokio::test]
    async fn a_wrong_code_is_never_heard_and_the_listener_gives_up_in_time() {
        let addr = mock_relay(false).await;
        let mut host = Listening::start(relay(addr).await, room("123456")).await.unwrap();
        let mut asker = relay(addr).await;
        let asked = tokio::spawn(async move { ask_by(&mut asker, &room("654321"), "v=0 offer", Instant::now() + Duration::from_millis(500)).await });
        let heard = host.next(Instant::now() + Duration::from_millis(500)).await;
        assert_eq!(heard.err().unwrap().to_string(), "No answer from the room");
        assert_eq!(asked.await.unwrap().err().unwrap().to_string(), "No answer from the room");
    }

    #[tokio::test]
    async fn a_refusal_ends_the_meeting_cleanly() {
        let addr = mock_relay(true).await;
        let e = ask(&mut relay(addr).await, &room("123456"), "v=0 offer").await.err().unwrap();
        assert!(e.is::<Refused>(), "{e}");
    }

    #[test]
    fn the_relays_see_a_hash_of_the_id_and_a_valid_signature_never_the_offer() {
        let inv = room("123456");
        assert_eq!(inv.tag().len(), 32);
        assert!(!inv.tag().contains(&inv.id));
        let sealed = inv.seal(b"offer", "v=0 secret");
        assert!(!sealed.contains("secret"));
        assert_eq!(inv.open(b"offer", &sealed).as_deref(), Some("v=0 secret"));
        assert_eq!(inv.open(b"answer", &sealed), None, "an offer can't pass for an answer");
        assert_eq!(room("000000").open(b"offer", &sealed), None);
        let key = new_key();
        let e = event(&key, 1, json!([["t", inv.tag()]]), &sealed);
        let id = hex::decode(e["id"].as_str().unwrap()).unwrap();
        let pk: [u8; 32] = hex::decode(e["pubkey"].as_str().unwrap()).unwrap().try_into().unwrap();
        let pk = VerifyingKey::from_bytes(&pk.into()).unwrap();
        let sig = Signature::try_from(&hex::decode(e["sig"].as_str().unwrap()).unwrap()[..]).unwrap();
        pk.verify_raw(&id, &sig).unwrap();
    }
}
