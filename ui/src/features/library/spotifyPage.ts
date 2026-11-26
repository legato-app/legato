/** An imported Spotify list's own page, from its id here. None for a list read from an export file (no id of Spotify's). */
export function spotifyPage(sourceId: string): string | null {
  const found = /^(album:)?([A-Za-z0-9]{22})$/.exec(sourceId)
  return found && `https://open.spotify.com/${found[1] ? 'album' : 'playlist'}/${found[2]}`
}
