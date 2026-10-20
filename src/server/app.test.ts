import { expect, test } from 'bun:test'
import { sign } from 'hono/jwt'

process.env.SESSION_SECRET = 'test-secret'
const { app } = await import('./app.js')

const meWith = (sid: string) => app.request('/api/me', { headers: { cookie: `sid=${sid}` } })
const now = () => Math.floor(Date.now() / 1000)

test('expired, forged and legacy session cookies are rejected', async () => {
  const id = crypto.randomUUID()
  const expired = await sign({ sub: id, exp: now() - 1 }, 'test-secret', 'HS256')
  const forged = await sign({ sub: id, exp: now() + 60 }, 'other-secret', 'HS256')
  const legacy = `${id}.c2lnbmF0dXJl`
  for (const sid of [expired, forged, legacy]) expect((await meWith(sid)).status).toBe(401)
})
