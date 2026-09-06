const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const { readFileSync } = require('node:fs')
const F = require('../finance.js')

function harness(state) {
  const nodes = new Map(); const delegated = {}; let undo; let saves = 0
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { handlers: {}, open: false, textContent: '', elements: new Proxy({}, { get(target, key) { return target[key] ||= { value: '', disabled: false } } }), addEventListener(type, handler) { this.handlers[type] = handler }, showModal() { this.open = true }, close() { this.open = false }, reset() {} })
    return nodes.get(id)
  }
  const scope = { window: {}, BudgetFinance: F, document: { querySelector: node, addEventListener(type, handler) { (delegated[type] ||= []).push(handler) } }, FormData: class { constructor(form) { return Object.entries(form.values)[Symbol.iterator]() } } }
  vm.runInNewContext(readFileSync(require.resolve('../finance-ui.js'), 'utf8'), scope)
  const ui = scope.window.createFinanceUI({ getState: () => state, save: () => saves++, renderAll() {}, money: String, esc: String, uid: () => 'new-row', today: () => '2026-09-05', toast: (text, action, callback) => { if (action === 'Undo') undo = callback }, award() {} })
  ui.bind()
  const requestDelete = value => delegated.click.forEach(handler => handler({ target: { closest: selector => selector === '[data-activity-remove]' ? { dataset: { activityRemove: value } } : null } }))
  return { ui, node, requestDelete, undo: () => undo(), saves: () => saves }
}
function state() { return F.migrate({ profile: {}, ui: {}, expenses: [], paydays: [{ id: 'pay', date: '2026-09-01', amount: 1000 }], goals: [{ id: 'g', name: 'Savings', saved: 100, contributions: [{ id: 'd', date: '2026-09-01', type: 'deposit', amount: 50, paycheckId: 'pay' }] }], debts: [] }) }

test('Balance journeys use ordered ledger effects and preserve an undated opening',()=>{
  const s=state(),h=harness(s),g=s.goals[0];g.contributions.push({id:'w',date:'2026-09-02',type:'withdrawal',amount:20})
  const before=JSON.stringify(g),series=h.ui.balanceSeries(g,'goal');assert.equal(series[0].date,null);assert.equal(series[2].amount,130);assert.equal(JSON.stringify(g),before)
  const d={openingBalance:300,history:[{id:'c',date:'2026-09-03',type:'charge',amount:50},{id:'p',date:'2026-09-01',type:'payment',amount:100}]}
  const debt=h.ui.balanceSeries(d,'debt');assert.equal(debt[1].amount,200);assert.equal(debt[2].amount,250)
})
test('Paycheck visuals combine spent and remaining allowances exactly once',()=>{
  const s=state(),h=harness(s);s.paycheckPlans.pay={savings:100,debt:200,other:150};s.expenses=[{id:'x',date:'2026-09-02',amount:30,paycheckId:'pay'}]
  const p=F.plan(s,'pay'),v=h.ui.paycheckSegments(p);assert.equal(v.find(r=>r.label==='Savings').amount,100);assert.equal(v.find(r=>r.label==='Other').amount,150);assert.equal(v.reduce((sum,r)=>sum+r.amount,0),1000)
  s.goals[0].contributions.push({id:'r',date:'2026-09-02',type:'return',amount:100,paycheckId:'pay'});const returned=h.ui.paycheckSegments(F.plan(s,'pay'));assert.ok(returned.every(r=>r.amount>=0))
})
test('Balance chart privacy suppresses line and point amounts without deleting records',()=>{
  const s=state(),h=harness(s);s.privateMode=true;const html=h.ui.balanceChart(s.goals[0],'goal');assert.ok(html.includes('Balances hidden'));assert.ok(!html.includes('<circle'));assert.ok(!html.includes('class="balance-line"'));assert.equal(s.goals[0].contributions.length,1)
})

test('In-app deletion requires confirmation; delete and Undo update account and paycheck', () => {
  const s = state(); const h = harness(s)
  h.requestDelete('goal:g:d'); assert.equal(h.node('#deleteActivityDialog').open, true)
  assert.equal(s.goals[0].contributions.length, 1); assert.equal(h.saves(), 0)
  h.node('#confirmActivityDelete').handlers.click()
  assert.equal(h.node('#deleteActivityDialog').open, false); assert.equal(F.balance(s.goals[0], 'goal'), 100)
  assert.equal(F.plan(s, 'pay').used, 0)
  h.undo(); assert.equal(F.balance(s.goals[0], 'goal'), 150); assert.equal(F.plan(s, 'pay').used, 50)
})
test('Confirmed deletion still cannot invalidate a later withdrawal', () => {
  const s = state(); s.goals[0].saved = 0; s.goals[0].contributions.push({ id: 'w', date: '2026-09-02', type: 'withdrawal', amount: 40 })
  const h = harness(s); h.requestDelete('goal:g:d'); h.node('#confirmActivityDelete').handlers.click()
  assert.equal(s.goals[0].contributions.length, 2); assert.equal(h.saves(), 0); assert.equal(F.balance(s.goals[0], 'goal'), 10)
})
test('Editing through the real form handler keeps the ID and updates the linked balance', () => {
  const s = state(); const h = harness(s)
  h.ui.openActivity('goal', 'g', 'deposit', 'd')
  const form = h.node('#activityForm'); form.values = { date: '2026-09-03', amount: '25', note: 'Corrected', paycheck: 'pay' }
  form.handlers.submit({ preventDefault() {}, target: form })
  assert.equal(s.goals[0].contributions.length, 1); assert.equal(s.goals[0].contributions[0].id, 'd')
  assert.equal(s.goals[0].contributions[0].note, 'Corrected'); assert.equal(F.balance(s.goals[0], 'goal'), 125)
  assert.equal(F.plan(s, 'pay').used, 25)
})
