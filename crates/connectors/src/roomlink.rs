//! A room over the internet, the link (`docs/rooms.md` › Over the internet): one WebRTC data channel (`str0m`, its own
//! UDP socket, driven here) turned into a byte stream, so the room's own wire (`rooms::join_over`, `Host::take`) runs
//! inside it unchanged. The offer and answer travel through `roomsignal`; candidates come with them (no trickle).

use anyhow::{Result, anyhow};
use std::net::SocketAddr;
use std::time::{Duration, Instant};
use str0m::change::{SdpAnswer, SdpOffer};
use str0m::channel::ChannelId;
use str0m::net::{Protocol, Receive};
use str0m::{Candidate, Event, IceConnectionState, Input, Output, Rtc};
use tokio::io::{AsyncReadExt, AsyncWriteExt, DuplexStream};
use tokio::net::UdpSocket;
use tokio::sync::oneshot;

/// The channel opens by then, or the two sides could not meet (two strict NATs: no TURN).
pub const OPEN_WAIT: Duration = Duration::from_secs(20);
/// What the room's side of the stream buffers.
const PIPE: usize = 64 * 1024;
/// One read from the room's side, sent as one message (the room's frames are at most 16 KB).
const CHUNK: usize = 16 * 1024;

/// This side's addresses for the other to try: the socket's own (`host`), and the public one STUN saw (`public`).
pub fn candidates(host: SocketAddr, public: Option<SocketAddr>) -> Vec<Candidate> {
    let mut out: Vec<Candidate> = Candidate::host(host, "udp").into_iter().collect();
    out.extend(public.filter(|p| *p != host).and_then(|p| Candidate::server_reflexive(p, host, "udp").ok()));
    out
}

fn rtc(local: Vec<Candidate>) -> Rtc {
    let mut rtc = Rtc::new(Instant::now());
    for c in local {
        rtc.add_local_candidate(c);
    }
    rtc
}

/// The listener's side: makes the offer, hands it to `ask` (the relays), takes the answer; the stream once the channel
/// opened.
pub async fn dial<F: Future<Output = Result<String>>>(socket: UdpSocket, local: Vec<Candidate>, ask: impl FnOnce(String) -> F) -> Result<DuplexStream> {
    let mut rtc = rtc(local);
    let mut change = rtc.sdp_api();
    let id = change.add_channel("room".into());
    let (offer, pending) = change.apply().ok_or_else(|| anyhow!("No offer"))?;
    let answer = SdpAnswer::from_sdp_string(&ask(offer.to_sdp_string()).await?).map_err(|_| anyhow!("Not an answer"))?;
    rtc.sdp_api().accept_answer(pending, answer)?;
    run(rtc, socket, Some(id)).await
}

/// The host's side: answers `offer`; the answer to send back, and the stream once the channel opened.
pub fn accept(socket: UdpSocket, local: Vec<Candidate>, offer: &str) -> Result<(String, impl Future<Output = Result<DuplexStream>> + use<>)> {
    let mut rtc = rtc(local);
    let offer = SdpOffer::from_sdp_string(offer).map_err(|_| anyhow!("Not an offer"))?;
    let answer = rtc.sdp_api().accept_offer(offer)?.to_sdp_string();
    Ok((answer, run(rtc, socket, None)))
}

/// Drives `rtc` on `socket` in a task of its own; the room's end of the stream once channel `id` (the dialer's) or the
/// first one the other side opens is open, else an error by `OPEN_WAIT`. The task ends with the channel, the connection or
/// the room's end of the stream (dropped: EOF).
async fn run(rtc: Rtc, socket: UdpSocket, id: Option<ChannelId>) -> Result<DuplexStream> {
    let (room, ours) = tokio::io::duplex(PIPE);
    let (open_tx, open_rx) = oneshot::channel();
    tokio::spawn(drive(rtc, socket, id, ours, open_tx, room));
    let room = tokio::time::timeout(OPEN_WAIT, open_rx).await.map_err(|_| anyhow!("Couldn’t reach the room"))?.map_err(|_| anyhow!("Couldn’t reach the room"))?;
    Ok(room)
}

async fn drive(mut rtc: Rtc, socket: UdpSocket, mut id: Option<ChannelId>, mut ours: DuplexStream, open: oneshot::Sender<DuplexStream>, room: DuplexStream) {
    let local = socket.local_addr().ok();
    let (mut open, mut room) = (Some(open), Some(room));
    let mut open_id = None;
    let mut net = vec![0u8; 2000];
    let mut app = vec![0u8; CHUNK];
    loop {
        // Drain to the next timeout (str0m: after every change).
        let wake = loop {
            match rtc.poll_output() {
                Ok(Output::Timeout(t)) => break t,
                Ok(Output::Transmit(t)) => {
                    let _ = socket.send_to(&t.contents, t.destination).await;
                }
                Ok(Output::Event(Event::ChannelOpen(c, _))) if id.is_none_or(|i| i == c) => {
                    id = Some(c);
                    open_id = Some(c);
                    if let (Some(tx), Some(r)) = (open.take(), room.take()) {
                        let _ = tx.send(r);
                    }
                }
                Ok(Output::Event(Event::ChannelData(d))) if Some(d.id) == open_id => {
                    if ours.write_all(&d.data).await.is_err() {
                        return;
                    }
                }
                Ok(Output::Event(Event::ChannelClose(c))) if Some(c) == open_id => return,
                Ok(Output::Event(Event::IceConnectionStateChange(IceConnectionState::Disconnected))) => return,
                Ok(Output::Event(_)) => {}
                Err(_) => return,
            }
        };
        let sleep = tokio::time::sleep_until(tokio::time::Instant::from_std(wake));
        let input = tokio::select! {
            () = sleep => Input::Timeout(Instant::now()),
            got = socket.recv_from(&mut net) => {
                let Ok((n, source)) = got else { return };
                let (Some(destination), Ok(contents)) = (local, net[..n].try_into()) else { continue };
                Input::Receive(Instant::now(), Receive { proto: Protocol::Udp, source, destination, contents })
            }
            read = ours.read(&mut app), if open_id.is_some() => {
                let Ok(n @ 1..) = read else { return };
                let Some(mut ch) = open_id.and_then(|c| rtc.channel(c)) else { return };
                if ch.write(true, &app[..n]).is_err() {
                    return;
                }
                continue;
            }
        };
        if rtc.handle_input(input).is_err() {
            return;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rooms::{Host, SILENT, join_over};
    use music_core::rooms::{Now, RoomSong, ToListener};
    use tokio::net::TcpListener;
    use tokio::sync::mpsc;

    async fn socket() -> (UdpSocket, Vec<Candidate>) {
        let s = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let c = candidates(s.local_addr().unwrap(), None);
        (s, c)
    }

    #[test]
    fn a_public_address_joins_the_own_one_once() {
        let host: SocketAddr = "192.168.1.20:50000".parse().unwrap();
        assert_eq!(candidates(host, None).len(), 1);
        assert_eq!(candidates(host, Some(host)).len(), 1);
        assert_eq!(candidates(host, Some("203.0.113.9:61000".parse().unwrap())).len(), 2);
    }

    #[tokio::test]
    async fn a_room_runs_over_the_data_channel_code_and_all() {
        let (l, _) = (TcpListener::bind("127.0.0.1:0").await.unwrap(), ());
        let (tx, _ev) = mpsc::unbounded_channel();
        let room = Host::start(l, "Salon".into(), "TOUR".into(), "042917".into(), tx);
        let (hs, hc) = socket().await;
        let (ls, lc) = socket().await;
        let (answered_tx, answered_rx) = oneshot::channel();
        // The relays stand-in: the offer goes straight to the host, its answer straight back.
        let listener = dial(ls, lc, |offer| async move {
            let (answer, opened) = accept(hs, hc, &offer)?;
            let _ = answered_tx.send(opened);
            Ok(answer)
        });
        let host_side = async move { answered_rx.await.unwrap().await };
        let (mine, theirs) = tokio::join!(listener, host_side);
        room.take(theirs.unwrap());
        let joined = join_over(mine.unwrap(), "042917", "Far", SILENT).await.unwrap();
        assert_eq!(joined.welcome.people, vec!["Far".to_string()]);
        room.set_now(Now { song: Some(RoomSong { title: "Over the sea".into(), artist: "Band".into(), youtube: Some("dQw4w9WgXcQ".into()), ..RoomSong::default() }), ..Now::default() });
        let mut messages = joined.messages;
        let now = loop {
            match tokio::time::timeout(Duration::from_secs(5), messages.recv()).await.unwrap().unwrap() {
                ToListener::Now { now } => break now,
                _ => continue,
            }
        };
        assert_eq!(now.song.unwrap().title, "Over the sea");
    }

    #[tokio::test]
    async fn nobody_answering_ends_in_time() {
        let (ls, lc) = socket().await;
        let e = dial(ls, lc, |_| async { Err(anyhow!("No answer from the room")) }).await.err().unwrap();
        assert_eq!(e.to_string(), "No answer from the room");
    }
}
