// One-time setup: prints the Spotify refresh token that api/top-tracks.js uses to read your top tracks.
//   1. Create an app at https://developer.spotify.com/dashboard (tick "Web API") with this Redirect URI:
//        http://127.0.0.1:8888/callback
//   2. node scripts/spotify-token.js <client id> <client secret>
//   3. Open the link it prints and approve; put the three values it prints into Vercel → Settings → Environment Variables
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'

const [clientId, clientSecret] = process.argv.slice(2)
if (!clientId || !clientSecret) throw new Error('usage: node scripts/spotify-token.js <client id> <client secret>')
const redirectUri = 'http://127.0.0.1:8888/callback'
const state = randomUUID() // only accept the callback that comes back from the link below

console.log('Open this link and approve:\nhttps://accounts.spotify.com/authorize?' +
  new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri, scope: 'user-top-read', state }))

const server = createServer(async (req, res) => {
  const params = new URL(req.url, redirectUri).searchParams
  if (params.get('state') !== state) return res.end('Ignored.') // e.g. the browser asking for a favicon
  server.close()
  if (!params.get('code')) {
    console.error('Not approved:', params.get('error'))
    return res.end('Not approved.')
  }

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`) },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: params.get('code'), redirect_uri: redirectUri }),
  })
  const tokens = await tokenRes.json()
  if (!tokens.refresh_token) {
    console.error('Spotify said:', tokens)
    return res.end('Failed, see the terminal.')
  }
  console.log(`\nSPOTIFY_CLIENT_ID=${clientId}\nSPOTIFY_CLIENT_SECRET=${clientSecret}\nSPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}`)
  res.end('Done, you can close this tab.')
}).listen(8888, '127.0.0.1')
