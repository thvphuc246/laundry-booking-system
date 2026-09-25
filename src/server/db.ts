import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema.js'

const pool = mysql.createPool({ uri: process.env.DATABASE_URL, timezone: 'Z', connectionLimit: 5 })
export const db = drizzle(pool, { schema, mode: 'default' })

export const BUILDING_ID = 1

export const isDuplicate = (e: unknown): boolean =>
  !!e && typeof e === 'object' && ((e as { code?: string }).code === 'ER_DUP_ENTRY' || isDuplicate((e as { cause?: unknown }).cause))
