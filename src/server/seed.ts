import { BUILDING_ID, db } from './db.js'
import { apartments, buildings } from './schema.js'

const codes = [
  ...Array.from({ length: 35 }, (_, i) => `A${i + 1}`),
  ...Array.from({ length: 35 }, (_, i) => `B${i + 36}`),
]

await db.insert(buildings).ignore().values({ id: BUILDING_ID, address: 'Forstmestarinpiha 2, 02610 Espoo' })
await db.insert(apartments).ignore().values(codes.map((code) => ({ building_id: BUILDING_ID, code })))
console.log(`Seeded building ${BUILDING_ID} with ${codes.length} apartments`)
process.exit(0)
