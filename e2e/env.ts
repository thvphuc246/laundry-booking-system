export const NOW = new Date('2026-09-21T10:00:00Z')
export const API_PORT = 3100
export const WEB_PORT = 5273

export const USERS = {
  admin: {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'admin@example.test',
    name: 'Ada Admin',
    status: 'new',
    apartment: null,
  },
  resident: {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'resident@example.test',
    name: 'Riku Resident',
    status: 'approved',
    apartment: 'A1',
  },
  applicant: {
    id: '00000000-0000-4000-8000-000000000003',
    email: 'applicant@example.test',
    name: 'Aino Applicant',
    status: 'new',
    apartment: null,
  },
} as const

export type Role = keyof typeof USERS

export const E2E_ENV = {
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'mysql://root:root@localhost:3306/laundry_e2e',
  SESSION_SECRET: 'e2e-session-secret',
  ADMIN_EMAILS: USERS.admin.email,
  GOOGLE_ID: 'e2e-google-id',
  GOOGLE_SECRET: 'e2e-google-secret',
}
