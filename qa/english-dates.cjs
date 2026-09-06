const { test } = require('node:test')
const assert = require('node:assert/strict')
const dates = require('../english-dates.js')

test('Displayed months and dates are English and independent of host locale', () => {
  assert.equal(dates.format('2026-09', 'month'), 'September 2026')
  assert.equal(dates.format('2026-09-06', 'date'), 'September 6, 2026')
  assert.equal(dates.format('', 'date'), 'Choose date')
  assert.equal(dates.format('2026-09', 'date'), 'Choose date')
  assert.equal(dates.format('2026-02-30', 'date'), 'Choose date')
})
test('Date validation respects real leap years, short months and all four-digit years', () => {
  for (const value of ['2024-02-29','2000-02-29','0004-02-29','9999-12-31']) assert.equal(dates.valid(value,'date'),true,value)
  for (const value of ['1900-02-29','2100-02-29','2026-04-31','0000-01-01','2026-00-01','2026-01-00','2026-01-32']) assert.equal(dates.valid(value,'date'),false,value)
  assert.equal(dates.days(4,2),29)
})
