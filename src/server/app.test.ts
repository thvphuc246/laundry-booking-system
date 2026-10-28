import { afterAll, expect, setSystemTime, test } from 'bun:test'
import { sign } from 'hono/jwt'

const NOW = new Date('2026-09-21T10:00:00Z')
setSystemTime(NOW)
afterAll(() => setSystemTime())

process.env.SESSION_SECRET = 'test-secret'
process.env.GOOGLE_ID = 'test-google-id'
process.env.GOOGLE_SECRET = 'test-google-secret'
const { app } = await import('./app.js')

const meWith = (sid: string) => app.request('/api/me', { headers: { cookie: `sid=${sid}` } })
const now = () => Math.floor(NOW.getTime() / 1000)

test('expired, forged and legacy session cookies are rejected', async () => {
  const id = crypto.randomUUID()
  const expired = await sign({ sub: id, exp: now() - 1 }, 'test-secret', 'HS256')
  const forged = await sign({ sub: id, exp: now() + 60 }, 'other-secret', 'HS256')
  const legacy = `${id}.c2lnbmF0dXJl`
  for (const sid of [expired, forged, legacy]) expect((await meWith(sid)).status).toBe(401)
})

test('cross-site state-changing requests are refused before reaching a route', async () => {
  const logoutFrom = (origin: string) =>
    app.request('/api/auth/logout', { method: 'POST', headers: { origin } })
  expect((await logoutFrom('https://evil.example')).status).toBe(403)
  expect((await logoutFrom('http://localhost')).status).toBe(200)
})

test('HTTP errors from middleware keep their status instead of becoming 500', async () => {
  const res = await app.request('/api/auth/google?code=x&state=forged')
  expect(res.status).toBe(401)
})
