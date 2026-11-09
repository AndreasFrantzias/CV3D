// Vercel serverless function behind the guitar's window: my most-played Spotify tracks of the last ~6 months.
// Needs SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REFRESH_TOKEN in Vercel's environment variables
// (get them with scripts/spotify-token.js). The secrets stay here on the server; the site only gets public track info.
export async function GET() {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env

  // swap the long-lived refresh token for a one-hour access token
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`) },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: SPOTIFY_REFRESH_TOKEN }),
  })
  if (!tokenRes.ok) return Response.json({ error: 'Spotify login failed' }, { status: 502 })
  const { access_token } = await tokenRes.json()

  const topRes = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=medium_term', {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!topRes.ok) return Response.json({ error: 'Spotify request failed' }, { status: 502 })
  const { items } = await topRes.json()

  const tracks = items.map((track) => ({
    id: track.id,
    name: track.name,
    artists: track.artists.map((artist) => artist.name).join(', '),
    image: track.album.images.at(-1)?.url, // smallest cover
    url: track.external_urls.spotify,
  }))
  // let Vercel's CDN serve the same answer for an hour, so visitors don't each hit Spotify
  return Response.json(tracks, { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' } })
}
