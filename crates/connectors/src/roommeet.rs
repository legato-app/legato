//! A room over the internet, both sides put together (`docs/rooms.md` › Over the internet): a UDP socket and its
//! addresses (`stun`), the offer and answer through a relay (`roomsignal`), the data channel as a stream (`roomlink`)
//! the room's own wire then runs on.

use crate::roomsignal::{Invite, Listening, RELAYS, Relay, connect};
use crate::{roomlink, roomsignal, stun};
use anyhow::{Result, anyhow};
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;
use str0m::Candidate;
use tokio::io::{AsyncRead, AsyncWrite, DuplexStream};
use tokio::net::{TcpStream, UdpSocket};
use tokio::sync::Semaphore;
use tokio::time::Instant;
use tokio_rustls::client::TlsStream;

/// Data channels being opened at once: an offer past it is left unanswered.
const AT_ONCE: usize = 4;
/// The host waits for offers as long as the room is open: its task is dropped with the room.
const FOREVER: Duration = Duration::from_secs(365 * 24 * 3600);

/// The first of the public relays that answers.
pub async fn first_relay() -> Result<Relay<TlsStream<TcpStream>>> {
    for host in RELAYS {
        if let Ok(relay) = connect(host).await {
            return Ok(relay);
        }
    }
    Err(anyhow!("No relay reachable"))
}

/// A socket on this device's address `local`, and what the other side may try: that address, and the public one `stun`
/// saw (none: the local network's only).
async fn socket(local: IpAddr, stun_server: Option<(&str, u16)>) -> Result<(UdpSocket, Vec<Candidate>)> {
    let socket = UdpSocket::bind(SocketAddr::new(local, 0)).await?;
    let public = match stun_server {
        Some(server) => stun::public_address(&socket, server).await.ok(),
        None => None,
    };
    let candidates = roomlink::candidates(socket.local_addr()?, public);
    Ok((socket, candidates))
}

/// The listener's side: the stream to the invite's host.
pub async fn join<S: AsyncRead + AsyncWrite + Unpin>(mut relay: Relay<S>, invite: Invite, local: IpAddr, stun_server: Option<(&str, u16)>) -> Result<DuplexStream> {
    let (socket, candidates) = socket(local, stun_server).await?;
    roomlink::dial(socket, candidates, |offer| async move { roomsignal::ask(&mut relay, &invite, &offer).await }).await
}

/// The host's side: answers every offer heard, each stream opened handed to `opened`, until the relay refuses or goes
/// (the error says which).
pub async fn host<S: AsyncRead + AsyncWrite + Unpin>(mut listening: Listening<S>, local: IpAddr, stun_server: Option<(&str, u16)>, opened: impl Fn(DuplexStream) + Clone + Send + 'static) -> anyhow::Error {
    let slots = Arc::new(Semaphore::new(AT_ONCE));
    loop {
        let offer = match listening.next(Instant::now() + FOREVER).await {
            Ok(offer) => offer,
            Err(e) => return e,
        };
        let Ok(slot) = slots.clone().try_acquire_owned() else { continue };
        // An offer that can't be answered is that listener's trouble, not the room's.
        let Ok((socket, candidates)) = socket(local, stun_server).await else { continue };
        let Ok((answer, opening)) = roomlink::accept(socket, candidates, &offer.sdp) else { continue };
        let opened = opened.clone();
        tokio::spawn(async move {
            if let Ok(stream) = opening.await {
                opened(stream);
            }
            drop(slot);
        });
        if let Err(e) = listening.answer(&offer, &answer).await {
            return e;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rooms::{Host, SILENT, join_over};
    use crate::roomsignal::tests::{mock_relay, relay};
    use tokio::net::TcpListener;
    use tokio::sync::mpsc;

    #[tokio::test]
    async fn an_invite_leads_into_the_room_through_the_relay() {
        let relay_address = mock_relay(false).await;
        let (events, _kept) = mpsc::unbounded_channel();
        let room = Arc::new(Host::start(TcpListener::bind("127.0.0.1:0").await.unwrap(), "Salon".into(), "TOUR".into(), "042917".into(), events));
        let invite = Invite { id: "0123456789abcdef".into(), code: "042917".into() };
        let local: IpAddr = "127.0.0.1".parse().unwrap();
        let listening = Listening::start(relay(relay_address).await, invite.clone()).await.unwrap();
        let hosted = room.clone();
        tokio::spawn(host(listening, local, None, move |stream| hosted.take(stream)));
        tokio::time::sleep(Duration::from_millis(100)).await;
        let stream = join(relay(relay_address).await, invite, local, None).await.unwrap();
        let joined = join_over(stream, "042917", "Far", SILENT).await.unwrap();
        assert_eq!(joined.welcome.people, vec!["Far".to_string()]);
    }
}
