const { test } = require('node:test')
const assert = require('node:assert/strict')
const F = require('../finance.js')
const tx = (id, type, amount, date = '2026-09-04') => ({ id, type, amount, date })
const base = () => F.migrate({ goals: [], debts: [], paydays: [{ id: 'pay', amount: 2300, date: '2026-09-14' }, { id: 'next', amount: 2000, date: '2026-09-28' }] })

test('Legacy debt migration preserves exact balance and existing payment history', () => {
  const s = base(); s.debts = [{ id: 'card', balance: 700, startingBalance: 1000, history: [{ id: 'old', date: '2026-09-01', amount: 100 }] }]
  F.migrate(s); assert.equal(s.debts[0].openingBalance, 800); assert.equal(s.debts[0].balance, 700)
  F.migrate(s); assert.equal(s.debts[0].balance, 700); assert.equal(s.debts[0].history[0].amount, 100)
})
test('Savings deposits, spending, returns and corrections have separate cash effects', () => {
  const goal = { saved: 100, contributions: [tx('a', 'deposit', 50), tx('b', 'withdrawal', 30), tx('c', 'return', 20), tx('d', 'adjustment', -10)] }
  assert.equal(F.validate(goal, 'goal'), 90); assert.equal(F.balance(goal, 'goal'), 90)
  assert.equal(goal.contributions.reduce((sum, row) => sum + F.cash(row, 'goal'), 0), 30)
})
test('New borrowing increases debt without being counted as a payment or income', () => {
  const debt = { openingBalance: 100, history: [tx('a', 'charge', 50), tx('b', 'payment', 25), tx('c', 'adjustment', 5)] }
  assert.equal(F.validate(debt, 'debt'), 130)
  assert.equal(debt.history.reduce((sum, row) => sum + F.cash(row, 'debt'), 0), 25)
})
test('Overpayments and overdrafts are rejected, never silently truncated', () => {
  assert.throws(() => F.validate({ openingBalance: 50, history: [tx('a', 'payment', 51)] }, 'debt'), /negative/)
  assert.throws(() => F.validate({ saved: 50, contributions: [tx('a', 'withdrawal', 51)] }, 'goal'), /negative/)
})
test('Backdated transactions must keep every historical balance nonnegative', () => {
  const goal = { saved: 0, contributions: [tx('a', 'deposit', 100, '2026-09-04'), tx('b', 'withdrawal', 50, '2026-09-03')] }
  assert.throws(() => F.validate(goal, 'goal'), /2026-09-03/)
})
test('Removing a deposit cannot invalidate a later withdrawal', () => {
  const goal = { saved: 0, contributions: [tx('a', 'deposit', 100), tx('b', 'withdrawal', 50)] }
  assert.equal(F.validate(goal, 'goal'), 50)
  assert.throws(() => F.validate(goal, 'goal', goal.contributions.slice(1)), /negative/)
})
test('Cent rounding prevents phantom negatives when paying an exact balance', () => {
  assert.equal(F.validate({ saved: .1, contributions: [tx('a', 'deposit', .2), tx('b', 'withdrawal', .3)] }, 'goal'), 0)
})
test('Paycheck allocations include cross-month bills and preserve negative remainder', () => {
  const s = base(); s.paycheckPlans.pay = { debt: 100, savings: 200, other: 300 }
  s.billAssignments['2026-10/rent'] = { paycheckId: 'pay', billId: 'rent', name: 'Rent', date: '2026-10-01', amount: 1240 }
  assert.equal(F.plan(s, 'pay').remaining, 460)
  s.paycheckPlans.pay.other = 1000; assert.equal(F.plan(s, 'pay').remaining, -240)
  assert.equal(F.plan(s, 'next').remaining, 2000)
})
test('A bill occurrence cannot be counted against two paychecks', () => {
  const s = base(); s.billAssignments['2026-09/rent'] = { paycheckId: 'pay', billId: 'rent', name: 'Rent', date: '2026-09-01', amount: 1000 }
  s.billAssignments['2026-09/rent'].paycheckId = 'next'
  assert.equal(F.plan(s, 'pay').buckets.bills, 0); assert.equal(F.plan(s, 'next').buckets.bills, 1000)
})
test('Linked plans and transactions protect paycheck identity', () => {
  const s = base(); assert.equal(F.referenced(s, 'pay'), false)
  s.goals.push({ saved: 0, contributions: [{ ...tx('a', 'deposit', 10), paycheckId: 'pay' }] })
  assert.equal(F.referenced(s, 'pay'), true)
})
test('Malformed history and assignments fail backup validation', () => {
  const s = base(); s.goals.push({ saved: 20, contributions: [tx('a', 'deposit', 5, '2026-02-31')] })
  assert.throws(() => F.validateState(s)); s.goals = []
  s.billAssignments['2026-09/rent'] = { paycheckId: 'unknown', billId: 'rent', name: 'Rent', date: '2026-09-01', amount: 50 }
  assert.throws(() => F.validateState(s))
})
test('Plans and ledger history survive JSON backup round trips', () => {
  const s = base(); s.paycheckPlans.pay = { debt: 100, savings: 200, other: 300 }
  s.goals.push({ id: 'g', saved: 400, contributions: [tx('a', 'withdrawal', 50)] })
  s.debts.push({ id: 'd', openingBalance: 100, balance: 125, history: [tx('b', 'charge', 25)] })
  const copy = F.migrate(JSON.parse(JSON.stringify(s))); F.validateState(copy)
  assert.equal(F.balance(copy.goals[0], 'goal'), 350); assert.equal(copy.debts[0].balance, 125)
  assert.equal(F.plan(copy, 'pay').remaining, 1700)
})

test('Customer example: 1800 income, 1530 used, 270 remaining', () => {
  const s = base(); s.paydays[0].amount = 1800
  for (const [id, amount] of [['rent', 900], ['electric', 120], ['internet', 60]]) s.billAssignments['2026-09/' + id] = { paycheckId: 'pay', billId: id, name: id, date: '2026-09-01', amount }
  s.expenses = [{ id: 'grocery', paycheckId: 'pay', amount: 200, date: '2026-09-04' }]
  s.goals = [{ id: 'goal', saved: 0, contributions: [{ ...tx('save', 'deposit', 100), paycheckId: 'pay' }] }]
  s.debts = [{ id: 'debt', openingBalance: 3000, history: [{ ...tx('payment', 'payment', 150), paycheckId: 'pay' }] }]
  let p = F.plan(s, 'pay'); assert.equal(p.used, 1530); assert.equal(p.total, 1530); assert.equal(p.remaining, 270)
  s.paycheckPlans.pay = { debt: 150, savings: 100, other: 200 }
  p = F.plan(s, 'pay'); assert.equal(p.reserved, 0); assert.equal(p.remaining, 270)
})
test('Partial and over-budget activity consumes allowances without double subtraction', () => {
  const s = base(); s.paycheckPlans.pay = { debt: 200, savings: 100, other: 200 }
  s.expenses = [{ id: 'a', amount: 250, paycheckId: 'pay' }, { id: 'b', amount: 999, paycheckId: 'next' }]
  s.debts = [{ openingBalance: 1000, history: [{ ...tx('p', 'payment', 150), paycheckId: 'pay' }] }]
  const p = F.plan(s, 'pay')
  assert.equal(p.used, 400); assert.equal(p.reserved, 150); assert.equal(p.total, 550); assert.equal(p.remaining, 1750)
})
test('Savings returned to a paycheck credits it once and preserves unused allowance', () => {
  const s = base(); s.paycheckPlans.pay = { savings: 100 }
  s.goals = [{ saved: 100, contributions: [{ ...tx('d', 'deposit', 50), paycheckId: 'pay' }, { ...tx('r', 'return', 20), paycheckId: 'pay' }] }]
  const p = F.plan(s, 'pay'); assert.equal(p.actual.savings, 30); assert.equal(p.pending.savings, 50); assert.equal(p.total, 80)
})
test('Editing a linked contribution updates the account and paycheck with the same ID', () => {
  const s = base(); const goal = { id: 'goal', saved: 2000, contributions: [{ ...tx('d', 'deposit', 300), paycheckId: 'pay' }] }; s.goals = [goal]
  F.updateTransaction(goal, 'goal', { ...goal.contributions[0], amount: 200, note: 'Corrected' }, 'd')
  assert.equal(F.balance(goal, 'goal'), 2200); assert.equal(F.plan(s, 'pay').actual.savings, 200)
  assert.equal(goal.contributions.length, 1); assert.equal(goal.contributions[0].id, 'd')
})
test('Editing a debt payment recalculates balance and total paid, not new charges', () => {
  const debt = { openingBalance: 3000, history: [tx('p', 'payment', 250), tx('c', 'charge', 300)] }
  F.updateTransaction(debt, 'debt', { ...debt.history[0], amount: 200 }, 'p')
  assert.equal(debt.balance, 3100)
  assert.equal(debt.history.filter(row => F.type(row, 'debt') === 'payment').reduce((sum, row) => sum + row.amount, 0), 200)
})
test('Invalid edits are atomic and preserve the original record and balance', () => {
  const goal = { saved: 0, contributions: [tx('d', 'deposit', 100), tx('w', 'withdrawal', 80)] }; const original = JSON.stringify(goal)
  assert.throws(() => F.updateTransaction(goal, 'goal', { ...goal.contributions[0], amount: 50 }, 'd'), /negative/)
  assert.equal(JSON.stringify(goal), original)
  assert.throws(() => F.updateTransaction(goal, 'goal', { ...goal.contributions[1], date: '2026-09-03' }, 'w'), /negative/)
  assert.equal(JSON.stringify(goal), original)
})
test('Reassigning and deleting spending affects only its linked paycheck', () => {
  const s = base(); s.expenses = [{ id: 'e', amount: 50, paycheckId: 'pay' }]
  assert.equal(F.referenced(s, 'pay'), true); assert.equal(F.plan(s, 'pay').used, 50)
  s.expenses[0].paycheckId = 'next'; assert.equal(F.plan(s, 'pay').used, 0); assert.equal(F.plan(s, 'next').used, 50)
  s.expenses = []; assert.equal(F.plan(s, 'next').used, 0)
})
