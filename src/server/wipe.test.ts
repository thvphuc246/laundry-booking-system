import { expect, test } from 'bun:test'
import { assertTestDb } from './wipe.js'

test('only localhost or a test database may be wiped', () => {
  expect(() => assertTestDb('mysql://root:root@localhost:3306/laundry')).not.toThrow()
  expect(() => assertTestDb('mysql://root:root@127.0.0.1:3306/laundry')).not.toThrow()
  expect(() =>
    assertTestDb('mysql://u:p@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/laundry_test'),
  ).not.toThrow()
  expect(() =>
    assertTestDb(
      'mysql://u:p@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/laundry?ssl={"rejectUnauthorized":true}',
    ),
  ).toThrow()
  expect(() => assertTestDb('mysql://u:p@test.example.com:4000/laundry')).toThrow()
  expect(() => assertTestDb('')).toThrow()
})
