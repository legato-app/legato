import { expect, it } from 'vitest'
import { spotifyPage } from './spotifyPage'

it("links an imported list to Spotify's own page when its id is Spotify's", () => {
  expect(spotifyPage('37i9dQZF1DXcBWIGoYBM5M')).toBe('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')
  expect(spotifyPage('album:2noRn2Aes5aoNVsU6iWThc')).toBe('https://open.spotify.com/album/2noRn2Aes5aoNVsU6iWThc')
  for (const other of ['export:chill_vibes', 'liked', '37i9dQZF1DXcBWIGoYBM5M/../x', '']) expect(spotifyPage(other)).toBeNull()
})
