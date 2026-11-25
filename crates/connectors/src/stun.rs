//! A room over the internet, each side's public address (`docs/rooms.md` › Over the internet): one STUN binding request
//! (RFC 5389) to Cloudflare's server from the socket the data channel will use. Cloudflare sees that address and the
//! time, nothing else.

use anyhow::{Result, anyhow};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::time::Duration;
use tokio::net::UdpSocket;

/// Cloudflare's public STUN (the owner's choice, 2026-11-07).
pub const SERVER: (&str, u16) = ("stun.cloudflare.com", 3478);
const MAGIC: u32 = 0x2112_A442;
const XOR_MAPPED: u16 = 0x0020;
const MAPPED: u16 = 0x0001;

fn request(id: &[u8; 12]) -> [u8; 20] {
    let mut b = [0u8; 20];
    b[..2].copy_from_slice(&1u16.to_be_bytes());
    b[4..8].copy_from_slice(&MAGIC.to_be_bytes());
    b[8..].copy_from_slice(id);
    b
}

/// The address a binding success answer gives for request `id` (XOR-MAPPED-ADDRESS, else MAPPED-ADDRESS). None: not
/// one, another request's, or unreadable.
fn mapped(b: &[u8], id: &[u8; 12]) -> Option<SocketAddr> {
    if b.len() < 20 || b[..2] != [0x01, 0x01] || b[4..8] != MAGIC.to_be_bytes() || b[8..20] != id[..] {
        return None;
    }
    let len = usize::from(u16::from_be_bytes([b[2], b[3]]));
    let body = b.get(20..20 + len)?;
    let (mut at, mut plain) = (0, None);
    while at + 4 <= body.len() {
        let kind = u16::from_be_bytes([body[at], body[at + 1]]);
        let n = usize::from(u16::from_be_bytes([body[at + 2], body[at + 3]]));
        let v = body.get(at + 4..at + 4 + n)?;
        match kind {
            XOR_MAPPED => return address(v, true, id),
            MAPPED => plain = address(v, false, id),
            _ => {}
        }
        // Attributes are padded to 4 bytes.
        at += 4 + n.div_ceil(4) * 4;
    }
    plain
}

fn address(v: &[u8], xor: bool, id: &[u8; 12]) -> Option<SocketAddr> {
    let m = MAGIC.to_be_bytes();
    let port = u16::from_be_bytes([*v.get(2)?, *v.get(3)?]) ^ if xor { (MAGIC >> 16) as u16 } else { 0 };
    let key: Vec<u8> = m.iter().chain(id).copied().collect();
    let ip = |n: usize| -> Option<Vec<u8>> { Some(v.get(4..4 + n)?.iter().zip(&key).map(|(a, k)| if xor { a ^ k } else { *a }).collect()) };
    let ip = match v.get(1)? {
        1 => IpAddr::V4(Ipv4Addr::from(<[u8; 4]>::try_from(ip(4)?).ok()?)),
        2 => IpAddr::V6(Ipv6Addr::from(<[u8; 16]>::try_from(ip(16)?).ok()?)),
        _ => return None,
    };
    Some(SocketAddr::new(ip, port))
}

/// This socket's address as the internet sees it, asked of `server` (noted, resolved like every host): 3 tries a second
/// apart (UDP may lose one), then an error.
pub async fn public_address(socket: &UdpSocket, server: (&str, u16)) -> Result<SocketAddr> {
    music_core::netlog::note(server.0, music_core::netlog::Via::App, false);
    let to = tokio::net::lookup_host(server).await?.find(|a| a.is_ipv4() == socket.local_addr().is_ok_and(|l| l.is_ipv4())).ok_or_else(|| anyhow!("No STUN address"))?;
    let id: [u8; 12] = rand::random();
    let mut buf = [0u8; 576];
    for _ in 0..3 {
        socket.send_to(&request(&id), to).await?;
        let end = tokio::time::Instant::now() + Duration::from_secs(1);
        while let Ok(Ok((n, from))) = tokio::time::timeout_at(end, socket.recv_from(&mut buf)).await {
            if from == to
                && let Some(a) = mapped(&buf[..n], &id)
            {
                return Ok(a);
            }
        }
    }
    Err(anyhow!("No answer from the STUN server"))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// An answer as a STUN server makes it: XOR-MAPPED-ADDRESS of `seen`.
    fn answer(id: &[u8; 12], seen: SocketAddr) -> Vec<u8> {
        let SocketAddr::V4(v4) = seen else { panic!() };
        let mut attr = vec![0, 1];
        attr.extend((v4.port() ^ (MAGIC >> 16) as u16).to_be_bytes());
        attr.extend(v4.ip().octets().iter().zip(MAGIC.to_be_bytes()).map(|(a, m)| a ^ m));
        let mut b = vec![0x01, 0x01, 0, 12];
        b.extend(MAGIC.to_be_bytes());
        b.extend(id);
        b.extend(XOR_MAPPED.to_be_bytes());
        b.extend(8u16.to_be_bytes());
        b.extend(attr);
        b
    }

    #[test]
    fn reads_the_address_and_only_its_own_answer() {
        let id = [7u8; 12];
        let seen: SocketAddr = "203.0.113.9:40123".parse().unwrap();
        assert_eq!(mapped(&answer(&id, seen), &id), Some(seen));
        assert_eq!(mapped(&answer(&id, seen), &[8u8; 12]), None, "another request's");
        assert_eq!(mapped(&answer(&id, seen)[..22], &id), None, "cut short");
        assert_eq!(mapped(b"hello", &id), None);
    }

    #[tokio::test]
    async fn asks_a_server_and_retries_a_lost_request() {
        let server = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let at = server.local_addr().unwrap();
        tokio::spawn(async move {
            let mut buf = [0u8; 64];
            // The first request is lost.
            let _ = server.recv_from(&mut buf).await.unwrap();
            let (n, from) = server.recv_from(&mut buf).await.unwrap();
            assert_eq!(n, 20);
            let id: [u8; 12] = buf[8..20].try_into().unwrap();
            server.send_to(&answer(&id, "198.51.100.4:5000".parse().unwrap()), from).await.unwrap();
        });
        let me = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        assert_eq!(public_address(&me, ("127.0.0.1", at.port())).await.unwrap(), "198.51.100.4:5000".parse().unwrap());
    }
}
