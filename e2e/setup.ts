import { sign } from 'hono/jwt'
import mysql from 'mysql2/promise'
import { assertTestDb } from '../src/server/wipe.js'
import { NOW, USERS } from './env'

const SECRET = process.env.SESSION_SECRET
if (!SECRET) throw new Error('SESSION_SECRET is not set')

assertTestDb()

const url = new URL(process.env.DATABASE_URL ?? '')
const name = url.pathname.slice(1)
url.pathname = '/'
const connection = await mysql.createConnection(url.toString())
await connection.query(`CREATE DATABASE IF NOT EXISTS \`${name}\``)
await connection.end()

const push = Bun.spawnSync(['bun', 'x', 'drizzle-kit', 'push', '--force'], {
  stdio: ['inherit', 'inherit', 'inherit'],
})
if (push.exitCode !== 0) process.exit(push.exitCode)

const seed = Bun.spawnSync(['bun', 'src/server/seed.ts'], {
  stdio: ['inherit', 'inherit', 'inherit'],
})
if (seed.exitCode !== 0) process.exit(seed.exitCode)

const exp = Math.floor(NOW.getTime() / 1000) + 60 * 60 * 24
for (const [role, user] of Object.entries(USERS)) {
  const value = await sign({ sub: user.id, exp }, SECRET, 'HS256')
  await Bun.write(
    `e2e/.auth/${role}.json`,
    JSON.stringify({
      cookies: [
        {
          name: 'sid',
          value,
          domain: 'localhost',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    }),
  )
}
process.exit(0)
