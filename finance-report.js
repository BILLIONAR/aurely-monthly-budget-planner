/* Local, read-only reports use the same ledger and paycheck calculations as the UI. */
(function (root) {
  'use strict'
  const F = typeof module === 'object' && module.exports ? require('./finance.js') : root.BudgetFinance
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
  const names = { deposit: 'Contribution', withdrawal: 'Withdrawal', return: 'Return to budget', payment: 'Payment', charge: 'New debt', adjustment: 'Balance correction' }
  function ledger(account, kind, month = '') {
    let running = F.opening(account, kind); let opening = running
    const rows = []
    for (const row of F.ordered(F.rows(account, kind))) {
      running = F.round(running + F.effect(row, kind))
      if (month && row.date.slice(0, 7) < month) opening = running
      if (!month || row.date.startsWith(month)) rows.push({ ...row, type: F.type(row, kind), change: F.effect(row, kind), balanceAfter: running })
    }
    return { opening, rows, closing: rows.length ? rows[rows.length - 1].balanceAfter : opening, current: F.balance(account, kind) }
  }
  function render(state, { month, allHistory = false, paycheckId = '', paychecks = true, history = true }, money) {
    const period = allHistory ? '' : month
    const payLabel = id => { const pay = state.paydays.find(row => row.id === id); return pay ? `${pay.name} · ${pay.date}` : 'Not linked' }
    const table = (headers, rows) => rows.length ? `<table class="finance-report-table"><thead><tr>${headers.map(label => `<th scope="col">${escape(label)}</th>`).join('')}</tr></thead><tbody>${rows.map(cells => `<tr>${cells.map(cell => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p>No records in this selection.</p>'
    const metrics = pairs => `<div class="print-metrics">${pairs.map(([label, value]) => `<span>${escape(label)}<b>${escape(money(value))}</b></span>`).join('')}</div>`
    const output = []
    if (paychecks) {
      const selected = state.paydays.filter(pay => paycheckId ? pay.id === paycheckId : !period || pay.date.startsWith(period)).sort((a, b) => a.date.localeCompare(b.date))
      output.push('<section class="finance-report"><h3>Paycheck budgets</h3><p class="report-note">Each paycheck includes all its linked activity, even across months. Assigned bills count before payment. Remaining is a plan, not a bank balance.</p>')
      if (!selected.length) output.push('<p>No saved paychecks in this selection.</p>')
      for (const pay of selected) {
        const p = F.plan(state, pay.id)
        output.push(`<article><h4>${escape(pay.name)} · ${escape(pay.date)}</h4>${metrics([['Income', pay.amount], ['Used / assigned', p.used], ['Still reserved', p.reserved], ['Remaining', p.remaining]])}`)
        output.push(table(['Paycheck flow', 'Amount', 'Left after this step'], F.flow(p).map(row => [row.label, (row.income || row.amount < 0 ? '+' : '−') + money(Math.abs(row.amount)), money(row.remaining)])))
        output.push(table(['Budget group', 'Used / assigned', 'Still reserved', 'Total planned'], [
          ['Bills', money(p.buckets.bills), money(0), money(p.buckets.bills)],
          ['Debt', money(p.actual.debt), money(p.pending.debt), money(F.round(p.actual.debt + p.pending.debt))],
          ['Savings', money(p.actual.savings), money(p.pending.savings), money(F.round(p.actual.savings + p.pending.savings))],
          ['Other / spending', money(p.actual.expenses), money(p.pending.other), money(F.round(p.actual.expenses + p.pending.other))],
          ['Total used + reserved', money(p.used), money(p.reserved), money(p.total)]
        ]))
        output.push('<h5>Assigned bills</h5>' + table(['Due date', 'Bill', 'Amount', 'Status'], p.bills.map(row => [row.date, row.name, money(row.amount), state.bills.find(bill => bill.id === row.billId)?.paidMonths?.[row.date.slice(0, 7)] ? 'Paid' : 'Not marked paid'])))
        output.push('<h5>Linked spending, savings & debt payments</h5>' + table(['Date', 'Type / account', 'Note', 'Paycheck use'], [
          ...p.expenses.map(row => ({ ...row, label: 'Spending · ' + row.category, used: row.amount })),
          ...p.activity.map(row => ({ ...row, label: names[row.type || F.type(row, row.kind)] + ' · ' + row.accountName, used: F.cash(row, row.kind) }))
        ].sort((a, b) => a.date.localeCompare(b.date)).map(row => [row.date, row.label, row.note || '', money(row.used)])) + '</article>')
      }
      output.push('</section>')
    }
    if (history) {
      output.push(`<section class="finance-report"><h3>Savings & debt transaction history</h3><p class="report-note">${period ? escape(period) + ' activity; opening includes earlier entries and closing excludes later entries.' : 'All recorded dates, across all years.'} Opening amounts from older records have no invented date. This section includes all accounts, independent of the paycheck selector.</p>`)
      for (const kind of ['goal', 'debt']) for (const account of kind === 'goal' ? state.goals : state.debts) {
        const report = ledger(account, kind, period)
        output.push(`<article><h4>${kind === 'goal' ? 'Savings' : 'Debt'} · ${escape(account.name)}</h4>${metrics([['Opening', report.opening], ['Closing', report.closing], ['Current · all recorded entries', report.current], kind === 'goal' ? ['Goal amount', account.target] : ['Total paid · selected period', F.round(report.rows.filter(row => row.type === 'payment').reduce((sum, row) => sum + Number(row.amount), 0))]])}`)
        output.push(table(['Date', 'Type', 'Amount ±', 'Note / paycheck', 'Balance after'], report.rows.map(row => [row.date, names[row.type], (row.change >= 0 ? '+' : '−') + money(Math.abs(row.change)), [row.note, payLabel(row.paycheckId)].filter(Boolean).join(' · '), money(row.balanceAfter)])) + '</article>')
      }
      if (!state.goals.length && !state.debts.length) output.push('<p>No savings or debt accounts saved.</p>')
      output.push('</section>')
    }
    return output.join('')
  }
  const api = { ledger, render }
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.BudgetReports = api
})(globalThis)
