# Listening rooms

One device leads a room; friends on the same network follow what plays there. Each listener plays the song from their
own source (their library, YouTube, their Spotify): no sound ever travels, only the song's description, where it is
and whether it plays. The local network today: no server, no relay. The internet half is being built (below).

| Part | Where |
| --- | --- |
| Rules: messages, checks, clock, drift, code, link, mDNS words | `crates/core/src/rooms.rs` (`music_core::rooms`) |
| The wire: handshake, sealed frames, host and listener tasks, mDNS | `crates/connectors/src/rooms.rs` |
| Shell: commands, events, the listener's search | `src-tauri/src/rooms.rs` |
| Interface: the room's view, the pill, reactions, the follow | `ui/src/features/rooms/` |
| What a listener's player does (pure, tested) | `ui/src/features/rooms/roomFollow.ts` |

## A room

- Start a room (the player's More › Listen together…, or a playlist's Share panel): the room is named after this
  device (`devices` name), gets a random 16-hex id and a 6-digit code, listens on TCP 47823 (another port when taken)
  and is announced on mDNS as `_legatoroom._tcp.local.` with its id, host name, how many listen and whether it's full.
- Join: the list of rooms heard (3 s of mDNS, private IPv4 addresses only), one picked, then its code; or the QR code
  (`legato://room?c=<code>&h=<address:port>&r=<id>`, private IPv4 only). The QR holds the code: whoever sees it can
  join.
- At most 8 listeners. 5 wrong codes and the room takes a new code (the host's view shows it), and joins shut 30 s,
  doubled at each new code up to 15 min (`rooms::shut_ms`: a new code alone left guesses unlimited; a join then hears
  "wait a few minutes"). 4 handshakes at a time;
  members don't count.
- A listener silent 15 s (3 ticks) is dropped; a host silent 15 s (asleep, off the network) is gone for its
  listeners. Every connection's task stops with the room. The host ending the room, or closing the app, ends it for
  everyone ("The room ended" / "The room's host left").

## The wire

1. The listener sends the room version in clear (`rooms::VERSION`); the host answers one byte: go, full, or another
   version ("This room runs another version of Legato").
2. SPAKE2 (Ed25519 group, symmetric, identity `legato-room-v1`) on the code, one per listener: a wrong code gives
   another key, so the first sealed frame fails and the host counts a try. The session key is
   SHA-256("legato-room-session-v1" ‖ SPAKE2 key).
3. Then ChaCha20-Poly1305 frames both ways, a length prefix checked against 16 KB before anything is read, a nonce made
   of who sends and a counter (a frame replayed or reordered fails).

Every text from the other side goes through `RoomSong::checked`: control characters out, 200 characters at most, ids
validated, a song with a path-like title refused, a cover kept only when https on a host the `art` scheme allows.

## Messages

Host to listener (`ToListener`): Welcome (room, host, people, now, next), Now (song, position, playing, the host's time,
a sequence bumped on a new song or a seek), Next (Up next's first 3 songs), Tick (position every 5 s), Pong (for the
clock), React (who, which), People, End.

Listener to host (`ToHost`): Hello (their device name), Ping (every 5 s, 3 quick ones at first), React (one per 0.4 s
at most), Leave.

Reactions are a fixed set of six (heart, fire, laugh, clap, party, wow); no free text travels.

## Following

- Clock: the median offset of the last 7 ping round trips under 3 s. The listener keeps the room's `Now` on the host's
  clock and turns it into its own when it looks.
- Once a second `roomFollow.ts` compares the room with the player: a new song → load it at the room's position; off by
  more than 1.5 s → seek, but not in the 4 s after a load or a seek (buffering), nor at the room song's end (its
  place stops at the host's length); play / pause as the host. The host sends its place again when its player slips
  by more than 1 s (buffering), a seek past 2.5 s.
- The song: the listener's library first (`Library::find`: source id, then ISRC, then title + artist + duration), then
  its YouTube id, then a version already known, then one search through the room's own `searchpace::Pace` (one at a
  time, a refusal waits 5 minutes; never routed around). Not found: "Can't find this song here", the player pauses and
  the room goes on; the next song tries again. Up next is looked for ahead, without a search unless the pace allows it;
  a song already being looked for waits for that answer (never two searches for one song).
- A listener may pause on their own (no seek or play forced while paused); Catch up plays, then seeks to the room as
  soon as it plays. Skip, seek,
  queue and play-now say "You follow the room: the host picks the songs", with Leave. A song that ends waits for the
  host instead of playing the listener's own Up next.

## Over the internet (plan-v2 line 17; never tried across two networks)

Desktop only: the host presses Invite over the internet and sends the link (`legato://room?c=…&r=…`, no address), the
guest pastes or opens it, then Join. The listener and the host meet once through public Nostr relays (relay.damus.io, nos.lol), then
talk directly over a WebRTC data channel (`str0m`, in Rust: never the WebView's), each side's public address learned from
Cloudflare's STUN; no TURN, so two strict NATs can't meet. Inside the channel the room's own wire runs unchanged (the
version, SPAKE2 on the code, sealed frames, tries counted).

- The meeting (`connectors/src/roomsignal.rs`): the listener sends its offer as an ephemeral event (kind 25473: relays
  forward it, keep nothing) tagged with SHA-256("legato-room-tag-v1" ‖ id) cut to 16 bytes, its content sealed with
  ChaCha20-Poly1305 under SHA-256("legato-room-offer-v1" ‖ id ‖ 0 ‖ code), "offer" bound in; the host, listening for that
  tag, answers with an event naming the offer's, sealed the same way ("answer"). A key is made for each meeting to sign
  them (BIP-340). An event that doesn't open is skipped; a relay's refusal (`OK` false, `CLOSED`) or 30 s with no answer
  ends the meeting, never retried sooner or elsewhere.
- Each side's public address (`connectors/src/stun.rs`): one STUN binding request to stun.cloudflare.com:3478 from the
  data channel's own UDP socket, 3 tries a second apart. Cloudflare sees that address and the time.
- The link (`connectors/src/roomlink.rs`, desktop only): the listener's `dial` makes an offer with one data channel
  ("room") and its candidates (the socket's own address and the public one), the host's `accept` answers; each side
  drives its `str0m` on its own UDP socket and hands the room a byte stream once the channel opened (20 s at most).
- What the relays see: the tag (a hash of the room's id, not the id), both public addresses, the times. Never the id,
  the code, the offer, songs, names or reactions.

## Privacy

What leaves the host, to the devices in the room only, sealed: the song (title, artist, album, length, ISRC, YouTube
and Spotify ids, an https cover address), its position, Up next's first 3, the device names in the room, reactions.
On mDNS, in clear, to the network: the room's id, the host device's name, how many listen, full or not. Never a file
path, an account, a token or sound. Over the internet, the relays and Cloudflare see what is listed above, and the two
sides see each other's IP address. The website's privacy row "Listening rooms" says the same; change both together.

## Tests

- `music_core::rooms`: messages both ways, the checks, the clock, the drift rule, the link, the mDNS words.
- `music_connectors::rooms`, over 127.0.0.1: two listeners following one song, a wrong code refused and too many
  changing it and shutting joins, a full room, the end heard, a host gone without a word, a host gone quiet, no task
  left reading once the room went, another version told before the code, a big
  frame before the code never read.
- `roomFollow.test.ts`: load, seek, play / pause, the quiet time, an own pause and Catch up, a missing song, a song
  ended here first, no seek back at the end, a host's seek while paused.
- `music_connectors::roomsignal`, on a mock relay (WebSocket on 127.0.0.1): an offer and its answer meet sealed, a wrong
  code never heard and the listener giving up in time, a refusal, the tag and a valid signature.
- `music_connectors::roomlink`: a real room (welcome, code, a song) over a data channel between two sockets on
  127.0.0.1, nobody answering ending in time.
- `music_connectors::stun`: an answer read (its own only), a lost request retried, on a UDP socket on 127.0.0.1.
- The interface in the site demo (an invented room to start or join). Two real devices: plan-v2 › Check live.
