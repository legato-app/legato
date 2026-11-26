//! A room over the internet (`docs/rooms.md` › Over the internet): the host listens on the public relays for offers,
//! an invited listener asks through one. All of it in `music_connectors::roommeet`; desktop only.

use super::{Mode, rooms_mode};
use crate::CmdResult;
use music_connectors::roommeet::{self, Tls};
use music_connectors::rooms::{self as wire, Joined};
use music_connectors::roomsignal::{self, Invite, RELAYS, Refused};
use music_connectors::stun;
use music_core::rooms::RoomLink;
use std::net::{IpAddr, Ipv4Addr};
use std::time::Duration;
use tauri::AppHandle;
use tauri::async_runtime::JoinHandle;

/// A relay that went (not one that refused) is asked again this long after.
const AGAIN: Duration = Duration::from_secs(30);

/// This device's address on its network: what the data channel's socket takes.
fn local_address() -> Result<IpAddr, &'static str> {
    crate::devices::lan_ips().first().copied().map(|ip: Ipv4Addr| IpAddr::V4(ip)).ok_or("No network")
}

/// Opens the room led here to the internet, under its code of now (again after a new code).
pub async fn open(app: &AppHandle) -> CmdResult<()> {
    let hosted = match &*rooms_mode(app) {
        Mode::Host(h) => Some(Invite { id: h.id.clone(), code: h.host.code() }),
        _ => None,
    };
    let invite = hosted.ok_or("Not hosting a room")?;
    let local = local_address()?;
    let mut tasks = Vec::new();
    for relay in RELAYS {
        match roommeet::listen(relay, invite.clone()).await {
            Ok(listening) => tasks.push(tauri::async_runtime::spawn(keep(app.clone(), relay, invite.clone(), local, listening))),
            Err(e) => crate::diag::warn("rooms", "a relay didn't answer", &e.to_string()),
        }
    }
    if tasks.is_empty() {
        return Err("No relay reachable".into());
    }
    match &mut *rooms_mode(app) {
        Mode::Host(h) if h.id == invite.id && h.host.code() == invite.code => abort(std::mem::replace(&mut h.internet, tasks)),
        // The room ended, or took another code, while the relays were reached.
        _ => abort(tasks),
    }
    Ok(())
}

fn abort(tasks: Vec<JoinHandle<()>>) {
    for task in tasks {
        task.abort();
    }
}

/// One relay's listening, for as long as the room is open: back after a cut, never after a refusal.
async fn keep(app: AppHandle, relay: &'static str, invite: Invite, local: IpAddr, mut listening: roomsignal::Listening<Tls>) {
    loop {
        let (a, id) = (app.clone(), invite.id.clone());
        let ended = roommeet::host(listening, local, Some(stun::SERVER), move |stream| {
            if let Mode::Host(h) = &*rooms_mode(&a)
                && h.id == id
            {
                h.host.take(stream);
            }
        })
        .await;
        crate::diag::warn("rooms", "a relay stopped", &ended.to_string());
        if ended.is::<Refused>() {
            return;
        }
        listening = loop {
            tokio::time::sleep(AGAIN).await;
            if let Ok(back) = roommeet::listen(relay, invite.clone()).await {
                break back;
            }
        };
    }
}

/// Joins the room an invite names: the meeting through a relay, then the room's own handshake inside the channel.
pub async fn join(link: RoomLink, name: &str) -> anyhow::Result<Joined> {
    let local = local_address().map_err(anyhow::Error::msg)?;
    let relay = roommeet::first_relay().await?;
    let stream = roommeet::join(relay, Invite { id: link.id, code: link.code.clone() }, local, Some(stun::SERVER)).await?;
    wire::join_over(stream, &link.code, name, wire::SILENT).await
}
