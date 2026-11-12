import { setSystemTime } from 'bun:test'
import { app } from '../src/server/app.js'
import { API_PORT, NOW } from './env'

setSystemTime(NOW)

export default { port: API_PORT, fetch: app.fetch }
