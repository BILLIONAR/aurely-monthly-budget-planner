const { test } = require('node:test')
const assert = require('node:assert/strict')
const F = require('../finance.js')
const R = require('../finance-report.js')
const money = n => '$' + Number(n).toFixed(2)
const row = (id, type, amount, date, note = '') => ({ id, type, amount, date, note, paycheckId: 'p' })
function fixture() {
  return F.migrate({
    paydays: [{ id: 'p', name: 'Paycheck 1', date: '2026-09-01', amount: 1800 }, { id: 'old', name: 'Old paycheck', date: '2025-12-31', amount: 500 }],
    paycheckPlans: { p: { debt: 150, savings: 100, other: 200 } },
    bills: [{ id: 'rent', paidMonths: { '2026-09': true } }],
    billAssignments: Object.fromEntries([['rent', 900], ['electric', 120], ['internet', 60]].map(([id, amount]) => ['2026-09/' + id, { billId: id, paycheckId: 'p', name: id, amount, date: '2026-09-10' }])),
    expenses: [{ id: 'food', paycheckId: 'p', date: '2026-09-02', category: 'Groceries', amount: 200, note: 'Weekly shop' }],
    goals: [{ id: 'g', name: 'Emergency', saved: 2000, target: 5000, contributions: [row('c', 'deposit', 100, '2026-09-02', 'Buffer'), row('w', 'withdrawal', 100, '2026-10-01', 'Car repair')] }],
    debts: [{ id: 'd', name: 'Card', openingBalance: 3000, history: [row('pay', 'payment', 150, '2026-09-03', 'September payment'), row('new', 'charge', 200, '2026-10-03', 'New purchase')] }]
  })
}
test('Paycheck report matches the 1800 / 1530 / 270 customer example without duplication', () => {
  const s = fixture(); const html = R.render(s, { month: '2026-09', history: false }, money)
  assert.match(html, /\$1800\.00/); assert.match(html, /\$1530\.00/); assert.match(html, /Remaining<b>\$270\.00/)
  for (const text of ['Bills', 'Debt', 'Savings', 'Other / spending', 'Weekly shop', 'September payment', 'Paid']) assert.ok(html.includes(text))
  assert.ok(!html.includes('Old paycheck'))
})
test('Monthly ledger carries earlier activity in, excludes later activity, and labels current separately', () => {
  const s = fixture(); const goal = s.goals[0]
  const sept = R.ledger(goal, 'goal', '2026-09'); assert.equal(sept.opening, 2000); assert.equal(sept.closing, 2100); assert.equal(sept.current, 2000)
  const oct = R.ledger(goal, 'goal', '2026-10'); assert.equal(oct.opening, 2100); assert.equal(oct.closing, 2000); assert.equal(oct.rows[0].balanceAfter, 2000)
  const nov = R.ledger(goal, 'goal', '2026-11'); assert.equal(nov.opening, 2000); assert.equal(nov.closing, 2000); assert.equal(nov.rows.length, 0)
  const dec = R.ledger(goal, 'goal', '2025-12'); assert.equal(dec.closing, 2000)
})
test('All-years and specific paycheck filters preserve cross-month links', () => {
  const s = fixture()
  assert.match(R.render(s, { month: '2030-01', allHistory: true }, money), /Old paycheck/)
  const selected = R.render(s, { month: '2030-01', paycheckId: 'p', history: false }, money)
  assert.match(selected, /Paycheck 1/); assert.match(selected, /September payment/); assert.ok(!selected.includes('Old paycheck'))
})
test('Reports rederive edited balances, include signed charges and notes, and do not mutate state', () => {
  const s = fixture(); F.updateTransaction(s.debts[0], 'debt', row('pay', 'payment', 100, '2026-09-03', 'Corrected'), 'pay')
  const before = JSON.stringify(s); const html = R.render(s, { month: '2026-09', allHistory: true }, money)
  assert.match(html, /Corrected/); assert.match(html, /New debt/); assert.match(html, /\+\$200\.00/); assert.match(html, /\$3100\.00/)
  assert.equal(JSON.stringify(s), before)
})
test('User-entered report content is escaped and empty reports explain the missing records', () => {
  const s = fixture(); s.goals[0].name = '<img onerror="alert(1)">'
  s.goals[0].contributions[0].note = '<script>bad</script>'
  const html = R.render(s, { month: '2026-09' }, money)
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img')); assert.match(html, /&lt;script&gt;/)
  assert.match(R.render(s, { month: '2040-01' }, money), /No saved paychecks/)
})
