import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'mysql',
  schema: './src/server/schema.ts',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
