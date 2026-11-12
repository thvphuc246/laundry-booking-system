import { eq } from 'drizzle-orm'
import { BUILDING_ID, db } from '../src/server/db.js'
import { apartments, users } from '../src/server/schema.js'
import { wipe } from '../src/server/wipe.js'
import { USERS } from './env'

await wipe()
const buildingApartments = await db
  .select()
  .from(apartments)
  .where(eq(apartments.building_id, BUILDING_ID))
for (const { id, email, name, status, apartment } of Object.values(USERS)) {
  const apartment_id = buildingApartments.find((a) => a.code === apartment)?.id ?? null
  await db
    .insert(users)
    .values({ id, email, name, status, apartment_id })
    .onDuplicateKeyUpdate({ set: { status, apartment_id } })
}
process.exit(0)
