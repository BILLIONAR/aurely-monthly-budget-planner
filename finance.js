/* Shared, cent-rounded calculations. Plans reserve money; they never post transactions. */
(function (root) {
  'use strict'
  const round = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100
  const rows = (account, kind) => kind === 'goal' ? account.contributions : account.history
  const type = (row, kind) => row.type || (kind === 'goal' ? 'deposit' : 'payment')
  const effect = (row, kind) => {
    const t = type(row, kind)
    return round(Number(row.amount) * (['withdrawal', 'return', 'payment'].includes(t) ? -1 : 1))
  }
  const opening = (account, kind) => Number(kind === 'goal' ? account.saved : account.openingBalance)
  const ordered = list => list.map((row, index) => ({ ...row, index })).sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index)
  const balance = (account, kind, list = rows(account, kind)) => round(opening(account, kind) + list.reduce((sum, row) => sum + effect(row, kind), 0))
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value
  const validate = (account, kind, list = rows(account, kind)) => {
    let running = opening(account, kind)
    if (!Number.isFinite(running) || running < 0 || !Array.isArray(list)) throw Error('Invalid opening balance or history.')
    const seen = new Set()
    for (const row of list) {
      const allowed = kind === 'goal' ? ['deposit', 'withdrawal', 'return', 'adjustment'] : ['payment', 'charge', 'adjustment']
      if (!row || typeof row.id !== 'string' || !/^[\w-]+$/.test(row.id) || seen.has(row.id) || !validDate(row.date) || !allowed.includes(type(row, kind)) || !Number.isFinite(Number(row.amount)) || (type(row, kind) !== 'adjustment' && Number(row.amount) <= 0)) throw Error('Invalid transaction. Check the date and amount.')
      seen.add(row.id)
    }
    for (const row of ordered(list)) {
      running = round(running + effect(row, kind))
      if (running < 0) throw Error('This would make the balance negative on ' + row.date + '. Check earlier transactions or use a smaller amount.')
    }
    return running
  }
  const cash = (row, kind) => {
    const t = type(row, kind)
    return t === 'deposit' || t === 'payment' ? Number(row.amount) : t === 'return' ? -Number(row.amount) : 0
  }
  const migrate = state => {
    state.paycheckPlans ||= {}
    state.billAssignments ||= {}
    state.goals.forEach(goal => { goal.contributions ||= [] })
    state.debts.forEach(debt => {
      debt.history ||= []
      // Older versions stored only the latest balance plus payments. Keep both intact.
      if (debt.openingBalance === undefined) debt.openingBalance = round(Number(debt.balance) - debt.history.reduce((sum, row) => sum + effect(row, 'debt'), 0))
      debt.balance = balance(debt, 'debt')
    })
    return state
  }
  const plan = (state, paycheckId) => {
    const paycheck = state.paydays.find(row => row.id === paycheckId)
    const saved = state.paycheckPlans[paycheckId] || {}
    const bills = Object.values(state.billAssignments).filter(row => row.paycheckId === paycheckId)
    const buckets = { bills: round(bills.reduce((sum, row) => sum + Number(row.amount), 0)), debt: Number(saved.debt || 0), savings: Number(saved.savings || 0), other: Number(saved.other || 0) }
    const expenses = (state.expenses || []).filter(row => paycheckId && row.paycheckId === paycheckId)
    const activity = ['goal', 'debt'].flatMap(kind => (kind === 'goal' ? state.goals : state.debts).flatMap(account => rows(account, kind).filter(row => paycheckId && row.paycheckId === paycheckId && cash(row, kind) !== 0).map(row => ({ ...row, kind, accountId: account.id, accountName: account.name }))))
    const sum = list => round(list.reduce((total, row) => total + Number(row.amount), 0))
    const actual = { expenses: sum(expenses), debt: sum(activity.filter(row => row.kind === 'debt')), contributions: sum(activity.filter(row => row.kind === 'goal' && type(row, 'goal') === 'deposit')), returns: sum(activity.filter(row => row.kind === 'goal' && type(row, 'goal') === 'return')) }
    actual.savings = round(actual.contributions - actual.returns)
    // A recorded payment consumes its allowance. Never add the full allowance again.
    const pending = { debt: round(Math.max(0, buckets.debt - actual.debt)), savings: round(Math.max(0, buckets.savings - actual.contributions)), other: round(Math.max(0, buckets.other - actual.expenses)) }
    const used = round(buckets.bills + actual.expenses + actual.debt + actual.savings)
    const reserved = round(Object.values(pending).reduce((sum, amount) => sum + amount, 0))
    const total = round(used + reserved)
    return { paycheck, bills, buckets, expenses, activity, actual, pending, used, reserved, total, remaining: round(Number(paycheck?.amount || 0) - total) }
  }
  const flow = p => {
    let remaining = round(p.paycheck?.amount || 0)
    return [
      { label: 'Paycheck', amount: remaining, income: true, detail: 'Saved income for this paycheck' },
      { label: 'Bills', amount: p.buckets.bills, detail: 'Assigned bills, paid or unpaid' },
      { label: 'Savings', amount: round(p.actual.savings + p.pending.savings), detail: 'Contributions + still reserved − returns' },
      { label: 'Debt', amount: round(p.actual.debt + p.pending.debt), detail: 'Payments + still reserved' },
      { label: 'Everyday spending', amount: round(p.actual.expenses + p.pending.other), detail: 'Spending + remaining Other allowance' }
    ].map(row => { if (!row.income) remaining = round(remaining - row.amount); return { ...row, remaining } })
  }
  const updateTransaction = (account, kind, row, existingId = '') => {
    const list = rows(account, kind); const index = existingId ? list.findIndex(item => item.id === existingId) : -1
    if (existingId && (index < 0 || row.id !== existingId)) throw Error('The original transaction could not be found.')
    const proposed = index < 0 ? [...list, row] : list.map((item, i) => i === index ? row : item)
    const next = validate(account, kind, proposed)
    if (index < 0) list.push(row); else list[index] = row
    if (kind === 'debt') account.balance = next
    return next
  }
  const referenced = (state, id) => Object.values(state.billAssignments).some(row => row.paycheckId === id) || Object.values(state.paycheckPlans[id] || {}).some(value => Number(value) > 0) || [...(state.expenses || []), ...state.goals.flatMap(row => row.contributions), ...state.debts.flatMap(row => row.history)].some(row => row.paycheckId === id)
  const validateState = state => {
    for (const kind of ['goal', 'debt']) for (const account of kind === 'goal' ? state.goals : state.debts) validate(account, kind)
    for (const row of [...(state.expenses || []), ...state.goals.flatMap(account => rows(account, 'goal')), ...state.debts.flatMap(account => rows(account, 'debt'))]) {
      if (row.paycheckId && !state.paydays.some(pay => pay.id === row.paycheckId)) throw Error('A transaction links to a missing paycheck.')
    }
    for (const map of [state.paycheckPlans, state.billAssignments]) if (!map || typeof map !== 'object' || Array.isArray(map)) throw Error('Invalid paycheck plans.')
    for (const [id, values] of Object.entries(state.paycheckPlans)) {
      if (!state.paydays.some(row => row.id === id) || !values || typeof values !== 'object' || ['debt', 'savings', 'other'].some(key => !Number.isFinite(Number(values[key] || 0)) || Number(values[key] || 0) < 0)) throw Error('Invalid paycheck allocation.')
    }
    for (const [key, row] of Object.entries(state.billAssignments)) {
      if (!row || !state.paydays.some(pay => pay.id === row.paycheckId) || !/^[\w-]+$/.test(row.billId) || !validDate(row.date) || key !== row.date.slice(0, 7) + '/' + row.billId || !Number.isFinite(Number(row.amount)) || Number(row.amount) < 0 || typeof row.name !== 'string') throw Error('Invalid bill assignment.')
    }
  }
  const api = { round, rows, type, effect, opening, ordered, balance, validDate, validate, cash, migrate, plan, flow, referenced, validateState, updateTransaction }
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.BudgetFinance = api
})(globalThis)
