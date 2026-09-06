const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { test } = require('node:test')

function planner(today = '2026-09-04T12:00:00') {
  const nodes = new Map()
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, { dataset: {}, style: { setProperty() {} }, classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, textContent: '', value: '' })
    return nodes.get(id)
  }
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [today])) } }
  const scope = { BudgetFinance: require('../finance.js'), Date: Clock, Intl, console, setTimeout: () => 0, clearTimeout() {}, setInterval() {}, localStorage: { getItem: () => null, setItem() {} }, document: { querySelector: node, querySelectorAll: () => [], addEventListener() {} }, window: { addEventListener() {} }, matchMedia: () => ({ matches: true }), cancelAnimationFrame() {} }
  const source = readFileSync(require.resolve('../app.js'), 'utf8')
  const boundary = source.indexOf('  const financeUI = createFinanceUI(')
  assert.ok(boundary > 0)
  vm.runInNewContext(source.slice(0, boundary) + `globalThis.qa = { get state() { return state }, set state(value) { state = mergeState(value) }, blankState, billsFor, incomeFor, remaining, divisor, forecastPaydaysFor, paydaysFor, dayItems, weeklySnapshot, parseBackup, renderSummary, goalTotal, goalDepositsFor, debtPaymentsFor, shiftDay, upcomingFor, dayJournal, renderMonthNotes }; })()`, scope)
  return { ...scope.qa, api: scope.qa, node }
}

test('Plans do not double count cash activity or treat new borrowing as payment', () => {
  const { api } = planner(); const s = api.blankState()
  s.paydays = [{ id: 'pay', date: '2026-09-04', amount: 1000 }]
  s.goals = [{ id: 'goal', saved: 100, keepOut: true, contributions: [{ id: 'dep', date: '2026-09-04', type: 'deposit', amount: 50 }, { id: 'spend', date: '2026-09-04', type: 'withdrawal', amount: 20 }] }]
  s.debts = [{ id: 'debt', openingBalance: 100, balance: 100, history: [{ id: 'charge', date: '2026-09-04', type: 'charge', amount: 200 }, { id: 'paymt', date: '2026-09-04', type: 'payment', amount: 25 }] }]
  s.paycheckPlans = { pay: { debt: 100, savings: 200, other: 300 } }; api.state = s
  assert.equal(api.remaining('2026-09'), 925)
  assert.equal(api.goalTotal(api.state.goals[0]), 130)
  assert.equal(api.state.debts[0].balance, 275)
  const restored = api.parseBackup(JSON.stringify(api.state)); assert.equal(restored.debts[0].balance, 275)
})
test('Today guide stays on current month when browsing a historical month', () => {
  const { api, node } = planner(); const state = api.blankState()
  state.selectedMonth = '2028-07'; state.paydays = [{ id: 'pay', date: '2026-09-14', amount: 2700 }]
  api.state = state; api.renderSummary()
  assert.equal(node('#todaySafe').textContent, '$100')
  assert.match(node('#todayFormula').textContent, /27 days left in September/)
  assert.equal(node('#metricIncome').textContent, '$0')
})
test('Legacy paid flag migrates to its saved month without paying every month', () => {
  const { api } = planner(); const state = api.blankState()
  state.bills = [{ id: 'rent', due: 31, amount: 100, paid: true }]
  api.state = state
  assert.equal(api.billsFor('2026-09')[0].paid, true)
  assert.equal(api.billsFor('2026-10')[0].paid, false)
  assert.equal(api.billsFor('2026-09')[0].due, 30)
  assert.equal(api.dayItems('2026-09-30').length, 1)
})
test('Per-month payment status survives backup and migration', () => {
  const { api } = planner(); const state = api.blankState()
  state.bills = [{ id: 'rent', due: 1, amount: 100, paidMonths: { '2026-09': true, '2026-10': false } }]
  api.state = api.parseBackup(JSON.stringify(state))
  assert.equal(api.billsFor('2026-09')[0].paid, true)
  assert.equal(api.billsFor('2026-10')[0].paid, false)
})
test('No phantom income after the final dated paycheck is removed', () => {
  const { api } = planner(); const state = api.blankState(); delete state.incomeByMonth
  state.income = 4600; state.paydays = [{ id: 'pay', date: '2026-09-14', amount: 2300 }]
  api.state = state; api.state.paydays = []
  assert.equal(api.incomeFor('2026-09'), 0)
  assert.equal(api.incomeFor('2027-09'), 0)
})
test('Legacy undated income is attached to one month', () => {
  const { api } = planner(); const state = api.blankState(); delete state.incomeByMonth
  state.income = 1234; api.state = state
  assert.equal(api.incomeFor('2026-09'), 1234)
  assert.equal(api.incomeFor('2026-10'), 0)
})
test('Weekend-early monthly payday crossing into the previous month remains visible', () => {
  const { api } = planner(); const state = api.blankState()
  Object.assign(state.profile, { usualPaycheck: 1000, payCycle: 'monthly', payAnchor: '2026-01-01', weekendEarly: true }); api.state = state
  assert.equal(api.forecastPaydaysFor('2026-07').find(row => row.date === '2026-07-31')?.amount, 1000)
  assert.equal(api.forecastPaydaysFor('2026-08').some(row => row.date === '2026-08-01'), false)
})
test('Weekly weekend-early payday crosses month boundary', () => {
  const { api } = planner(); const state = api.blankState()
  Object.assign(state.profile, { usualPaycheck: 100, payCycle: 'weekly', payAnchor: '2026-08-01', weekendEarly: true }); api.state = state
  assert.ok(api.forecastPaydaysFor('2026-07').some(row => row.date === '2026-07-31'))
})
test('Recording one payday replaces only the forecast on that date', () => {
  const { api } = planner(); const state = api.blankState()
  Object.assign(state.profile, { usualPaycheck: 100, payCycle: 'twice-monthly' }); state.paydays = [{ id: 'pay', date: '2026-09-15', amount: 110 }]; api.state = state
  assert.equal(api.paydaysFor('2026-09').length, 2)
  assert.equal(api.incomeFor('2026-09'), 210)
})
test('Seven-day review crosses month boundaries and ignores future records', () => {
  const { api } = planner(); const state = api.blankState()
  state.expenses = [{ id: 'a', date: '2026-08-30', amount: 20, category: 'Home' }, { id: 'b', date: '2026-09-04', amount: 10, category: 'Home' }, { id: 'c', date: '2026-09-05', amount: 99, category: 'Home' }]
  state.noSpendDays = ['2026-09-01', '2026-09-04']; api.state = state
  assert.equal(api.weeklySnapshot().total, 30)
  assert.equal(api.weeklySnapshot().checkIns, 3)
})
test('Malformed and future-version backups are rejected before replacement', () => {
  const { api } = planner()
  for (const bad of ['{}', '[]', '{"state":{}}', JSON.stringify({ ...api.blankState(), version: 999 }), JSON.stringify({ ...api.blankState(), expenses: [null] }), JSON.stringify({ ...api.blankState(), expenses: [{ id: 'bad', date: '2026-02-31', amount: 2, category: 'Home' }] })]) assert.throws(() => api.parseBackup(bad))
})

test('Complete backup round trip preserves paycheck links, both ledgers, notes, preferences and report totals', () => {
  const { api } = planner(); const F = require('../finance.js'); const R = require('../finance-report.js'); const s = api.blankState()
  s.paydays = [{ id: 'p', name: 'September pay', amount: 1800, date: '2026-09-01' }]
  s.bills = [{ id: 'rent', name: 'Rent', due: 1, amount: 900, paidMonths: { '2026-09': true } }]
  s.billAssignments = { '2026-09/rent': { billId: 'rent', name: 'Rent', amount: 900, date: '2026-09-01', paycheckId: 'p' } }
  s.paycheckPlans = { p: { savings: 100, debt: 200, other: 200 } }
  s.expenses = [{ id: 'e', amount: 200, date: '2026-09-02', category: 'Groceries', note: 'Food', paycheckId: 'p' }]
  s.goals = [{ id: 'g', name: 'Buffer', target: 5000, saved: 2000, contributions: [{ id: 'c', type: 'deposit', amount: 100, date: '2026-09-02', note: 'From pay', paycheckId: 'p' }, { id: 'w', type: 'withdrawal', amount: 100, date: '2026-09-03', note: 'Car repair' }] }]
  s.debts = [{ id: 'd', name: 'Card', openingBalance: 3000, history: [{ id: 'a', type: 'charge', amount: 200, date: '2026-09-02', note: 'New charge' }, { id: 'b', type: 'payment', amount: 200, date: '2026-09-03', note: 'Paid from salary', paycheckId: 'p' }] }]
  s.theme.main = '#345678'; s.notes['2026-09'] = 'September note'; s.ui.printAllHistory = true; s.ui.printPaycheck = 'p'; api.state = s
  const restored = api.parseBackup(JSON.stringify({ app: 'AurelyStudio Monthly Budget Planner', version: 9, state: api.state }))
  assert.equal(JSON.stringify(restored), JSON.stringify(api.state))
  assert.equal(F.balance(restored.goals[0], 'goal'), 2000); assert.equal(F.balance(restored.debts[0], 'debt'), 3000)
  assert.equal(F.plan(restored, 'p').remaining, 400)
  const options = { month: '2026-09', allHistory: true }
  assert.equal(R.render(restored, options, String), R.render(api.state, options, String))
})

test('Six-week upcoming dates cross the year boundary and respect per-month paid status', () => {
  const { api } = planner('2026-12-20T12:00:00'); const s = api.blankState()
  s.bills = [{ id:'rent', name:'Rent', amount:500, due:1, paidMonths:{'2027-01':true} }, { id:'phone', name:'Phone', amount:20, due:30 }]
  s.paydays = [{id:'inside', name:'January pay', amount:1000, date:'2027-01-30'}, {id:'outside', name:'Too late', amount:1000, date:'2027-01-31'}]
  api.state = s
  const rows = api.upcomingFor('2026-12-20')
  assert.equal(api.shiftDay('2026-12-20',41), '2027-01-30')
  assert.equal(rows.some(row => row.label === 'Rent'), false)
  assert.ok(rows.some(row => row.date === '2026-12-30'))
  assert.ok(rows.some(row => row.date === '2027-01-30' && row.label === 'January pay'))
  assert.equal(rows.some(row => row.date > '2027-01-30'), false)
})

test('Daily journal uses exact dates, rounds money and never invents a date for legacy intentions', () => {
  const { api } = planner(); const s = api.blankState()
  s.expenses = [{id:'a', date:'2025-09-04', amount:.1, category:'Other'}, {id:'b', date:'2025-09-04', amount:.2, category:'Other'}, {id:'c',date:'2026-09-04',amount:90, category:'Other'}]
  s.intention = 'Older undated thought'; s.dailyIntentions = {'2025-09-04':{text:'Keep my receipt'}}
  s.noSpendDays = ['2025-09-04','2025-09-05']; api.state = s
  assert.equal(api.dayJournal('2025-09-04').total,.3)
  assert.equal(api.dayJournal('2025-09-04').intention,'Keep my receipt')
  assert.equal(api.dayJournal('2025-09-04').noSpend,false)
  assert.equal(api.dayJournal('2025-09-05').noSpend,true)
  assert.equal(api.dayJournal('2026-09-04').intention,'')
})

test('Multiple kept notes, older drafts and dated intentions survive backup without changing money', () => {
  const { api, node } = planner(); const s = api.blankState()
  s.monthNotes = {'2026-09':[{id:'a',date:'2026-09-04',text:'First note'}, {id:'b',date:'2026-09-05',text:'<img src=x onerror=alert(1)>'}], '2025-09':[{id:'old',date:'2025-09-01',text:'Earlier year'}]}
  s.notes = {'2026-09':'Unfinished draft'}; s.dailyIntentions = {'2026-09-04':{text:'Daily note',savedAt:'2026-09-04T12:00:00Z'}}
  api.state = api.parseBackup(JSON.stringify(s)); api.renderMonthNotes()
  assert.equal(api.remaining('2026-09'),0)
  assert.equal(api.state.monthNotes['2025-09'][0].text,'Earlier year')
  assert.equal(api.state.notes['2026-09'],'Unfinished draft')
  assert.equal(node('#monthNoteCount').textContent,'2 notes kept')
  assert.match(node('#keptMonthNotes').innerHTML,/&lt;img/)
  assert.doesNotMatch(node('#keptMonthNotes').innerHTML,/<img/)
})

test('Malformed note collections and duplicate kept-note IDs cannot silently replace saved data', () => {
  const { api } = planner()
  for (const field of ['monthNotes','dailyIntentions','notes']) assert.throws(() => api.parseBackup(JSON.stringify({...api.blankState(),[field]:[]})))
  for (const notes of [ {'2026-13':[]}, {'2026-09':[{id:'a',date:'2026-02-30',text:'Invalid date'}]}, {'2026-09':[{id:'a',date:'2026-09-01',text:'A'},{id:'a',date:'2026-09-02',text:'B'}]} ]) assert.throws(() => api.parseBackup(JSON.stringify({...api.blankState(), monthNotes:notes})))
})
