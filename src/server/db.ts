import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema.js'

const pool = mysql.createPool({ uri: process.env.DATABASE_URL, timezone: 'Z', connectionLimit: 5 })
export const db = drizzle(pool, { schema, mode: 'default' })

export const BUILDING_ID = '6f1c2e0a-3b7d-4c52-9a8e-1d4f5b6c7a80'

export const isDuplicate = (e: unknown): boolean =>
  !!e &&
  typeof e === 'object' &&
  ((e as { code?: string }).code === 'ER_DUP_ENTRY' ||
    isDuplicate((e as { cause?: unknown }).cause))
