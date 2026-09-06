/* Paycheck planning and dated savings/debt activity; shares the app's existing state. */
window.createFinanceUI = function ({ getState, save, renderAll, money, esc, uid, today, switchView, toast, openExpense }) {
  const F = BudgetFinance
  const $ = selector => document.querySelector(selector)
  const state = getState
  let selectedPaycheck = ''; let viewedMonth = ''; let billMonth = ''; let editing = null; let pendingDeletion = null
  const label = row => `${row.date} · ${row.name} · ${money(row.amount)}`
  const payOptions = selected => '<option value="">Not linked to a paycheck</option>' + [...state().paydays].sort((a, b) => b.date.localeCompare(a.date)).map(row => `<option value="${esc(row.id)}"${row.id === selected ? ' selected' : ''}>${esc(label(row))}</option>`).join('')
  const names = { deposit: 'Add money', withdrawal: 'Withdraw money', return: 'Return to budget', payment: 'Add payment', charge: 'Add debt / charge', adjustment: 'Balance correction' }
  const accountFor = (kind, id) => (kind === 'goal' ? state().goals : state().debts).find(row => row.id === id)
  const balanceSeries = (account, kind) => {
    let amount = F.opening(account, kind)
    return [{date:null,amount,id:null}, ...F.ordered(F.rows(account,kind)).map(row => {
      amount = F.round(amount + F.effect(row,kind))
      return {date:row.date,amount,id:row.id}
    })]
  }
  const balanceChart = (account, kind) => {
    const full = balanceSeries(account,kind), points = full.slice(-30)
    const privateMode = state().privateMode
    const max = Math.max(1,...points.map(row=>row.amount))
    const coordinates = points.map((row,i)=>({ ...row, x:16+i/Math.max(1,points.length-1)*468, y:privateMode?142:142-row.amount/max*116 }))
    const path = coordinates.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ')
    const last=points[points.length-1], change=F.round(last.amount-full[0].amount)
    const latest = last.id ? `<button type="button" class="chart-text-button" data-activity-edit="${kind}:${account.id}:${last.id}">Review latest transaction →</button>` : '<span>Add a transaction to start your timeline.</span>'
    return `<section class="balance-visual ${kind==='debt'?'balance-debt':''}" aria-label="${esc(account.name)} balance history"><div class="visual-heading"><span>BALANCE JOURNEY</span><strong class="money">${privateMode?'••••':(change<0?'−':'+')+money(Math.abs(change))}</strong></div><p>Change from opening balance · ${full.length-1} ${full.length===2?'transaction':'transactions'}</p><svg viewBox="0 0 500 166" role="img" aria-label="${privateMode?'Balances hidden':esc(account.name)+' balance by transaction, not evenly spaced calendar dates. Full values are in Transaction history.'}"><path class="chart-gridline" d="M16 26H484 M16 84H484 M16 142H484"/>${!privateMode?`<path class="balance-area" d="${path} L${coordinates[coordinates.length-1].x} 142 L16 142Z"/><path class="balance-line" d="${path}"/>${coordinates.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="3.5"><title>${p.date||'Opening (undated)'} · ${money(p.amount)}</title></circle>`).join('')}`:''}</svg><div class="visual-caption"><span>${points[0].date||'Opening · undated'}</span><span>${last.date||'No dated activity yet'}</span></div><div class="balance-visual-footer">${latest}<small>By transaction${full.length>30?' · last 30 balances':''}</small></div></section>`
  }
  const paycheckSegments = p => [
    {label:'Bills',amount:p.buckets.bills,color:'#d89077'},
    {label:'Debt',amount:F.round(p.actual.debt+p.pending.debt),color:'#c6a150'},
    {label:'Savings',amount:Math.max(0,F.round(p.actual.savings+p.pending.savings)),color:'#70aa90'},
    {label:'Other',amount:F.round(p.actual.expenses+p.pending.other),color:'var(--main)'},
    {label:'Left',amount:Math.max(0,p.remaining),color:'var(--line)'}
  ]
  const paycheckVisual = p => {
    const segments=paycheckSegments(p), total=segments.reduce((sum,row)=>sum+row.amount,0)
    return `<section class="paycheck-visual" aria-label="Paycheck allocation chart"><div class="visual-heading"><span>YOUR PAYCHECK, DIVIDED</span><span>${p.remaining<0?'Overallocated · review your plan':'Every part has a place'}</span></div><div class="paycheck-stack" role="img" aria-label="Allocation including unspent allowances; exact amounts follow.">${state().privateMode||!total?'<i style="width:100%;background:var(--line)"></i>':segments.filter(row=>row.amount>0).map(row=>`<i style="width:${row.amount/total*100}%;background:${row.color}" title="${row.label}: ${money(row.amount)}"></i>`).join('')}</div><div class="paycheck-visual-key">${segments.map(row=>`<div><span><i style="background:${row.color}"></i>${row.label}</span><strong class="money">${money(row.amount)}</strong></div>`).join('')}</div><p class="finance-hint">Includes recorded activity and still-reserved allowances. Savings returns can release money back to this paycheck.</p></section>`
  }
  const buttons = (account, kind) => `<div class="finance-actions">${(kind === 'goal' ? ['deposit', 'withdrawal', 'return', 'adjustment'] : ['payment', 'charge', 'adjustment']).map(type => `<button type="button" data-activity="${kind}:${account.id}:${type}">${names[type]}</button>`).join('')}<button type="button" data-account-edit="${kind}:${account.id}">Edit ${kind === 'goal' ? 'goal' : 'account'}</button></div>`
  const history = (account, kind) => {
    const list = F.ordered(F.rows(account, kind)); let running = F.opening(account, kind)
    const rendered = list.map(row => {
      running = F.round(running + F.effect(row, kind))
      const pay = state().paydays.find(item => item.id === row.paycheckId)
      return `<li><div><strong>${esc(names[F.type(row, kind)])}</strong><small>${esc(row.date)}${pay ? ' · ' + esc(pay.name) + ' (' + esc(pay.date) + ')' : ''}</small>${row.note ? `<p>${esc(row.note)}</p>` : ''}</div><div class="activity-value"><b class="money">${F.effect(row, kind) < 0 ? '−' : '+'}${money(Math.abs(F.effect(row, kind)))}</b><small>Balance ${money(running)}</small><button type="button" data-activity-edit="${kind}:${account.id}:${row.id}">Edit</button><button type="button" data-activity-remove="${kind}:${account.id}:${row.id}">Delete</button></div></li>`
    }).reverse().join('')
    return `<details class="activity-history"><summary>Transaction history <span>${list.length}</span></summary><p class="finance-hint">Opening balance: ${money(F.opening(account, kind))}. Older starting amounts have no recorded date.</p><ol>${rendered || '<li>No transactions yet.</li>'}</ol></details>`
  }

  const accountSummary = (account, kind) => {
    const current = F.balance(account, kind)
    const original = Number(account.startingBalance ?? F.opening(account, kind))
    const paid = kind === 'debt' ? F.rows(account, kind).filter(row => F.type(row, kind) === 'payment').reduce((sum, row) => sum + Number(row.amount), 0) : 0
    const values = kind === 'goal'
      ? [['Goal amount', money(account.target)], ['Current saved', money(current)], ['Remaining to goal', money(Math.max(0, Number(account.target) - current))], ['Progress', Math.min(100, Math.round(current / Math.max(.01, Number(account.target)) * 100)) + '%']]
      : [['Starting debt', money(original)], ['Total paid', money(paid)], ['Remaining balance', money(current)], ['Progress', Math.max(0, Math.min(100, Math.round((original - current) / Math.max(.01, original) * 100))) + '%']]
    return '<dl class="account-metrics">' + values.map(([name, value]) => '<div><dt>' + name + '</dt><dd class="money">' + value + '</dd></div>').join('') + '</dl>'
  }

  const overview = p => `<section id="paycheckOverview" aria-label="Paycheck totals"><div class="paycheck-balance${p.remaining < 0 ? ' over-budget' : ''}" role="status"><span>${p.remaining < 0 ? 'Over budget' : 'Remaining'}<small>${esc(p.paycheck.name)} · ${esc(p.paycheck.date)}</small></span><strong class="money">${money(p.remaining)}</strong></div>${paycheckVisual(p)}<details class="visual-details"><summary>How this paycheck is calculated</summary><dl class="paycheck-totals"><div><dt>Income</dt><dd class="money">${money(p.paycheck.amount)}</dd></div><div><dt>Used / assigned</dt><dd class="money">${money(p.used)}</dd></div><div><dt>Still reserved</dt><dd class="money">${money(p.reserved)}</dd></div><div><dt>Total used + reserved</dt><dd class="money">${money(p.total)}</dd></div></dl><p class="finance-hint">Remaining = income − used/assigned − still reserved. Assigned bills count even when unpaid. This is a plan, not a bank balance.</p><div class="paycheck-breakdown"><div><span>Bills assigned</span><b class="money">${money(p.buckets.bills)}</b></div><div><span>Spending recorded</span><b class="money">${money(p.actual.expenses)}</b></div><div><span>Debt payments recorded</span><b class="money">${money(p.actual.debt)}</b></div><div><span>Savings contributed, less returns</span><b class="money">${money(p.actual.savings)}</b></div></div><p class="finance-hint">Not yet used: debt ${money(p.pending.debt)} · savings ${money(p.pending.savings)} · other ${money(p.pending.other)}. Recorded transactions consume these allowances; they are not counted twice.</p></details></section>`
  const paycheckActivity = p => `<section class="paycheck-activity"><div class="card-heading"><h3>Spending from this paycheck</h3><button class="primary-button" type="button" data-paycheck-spend="${esc(p.paycheck.id)}">+ Spending</button></div>${p.expenses.map(row => `<div class="plan-bill"><span><strong>${esc(row.note || row.category)}</strong><small>${esc(row.date)} · ${esc(row.category)}</small></span><b class="money">${money(row.amount)}</b><button type="button" data-expense-edit="${row.id}">Edit</button><button type="button" data-expense-remove="${row.id}">Delete</button></div>`).join('') || '<p class="finance-hint">No spending linked. Add one here or choose this paycheck when editing an existing expense.</p>'}<details><summary>Assign existing spending</summary>${state().expenses.filter(row => !row.paycheckId && row.date.startsWith(state().selectedMonth)).map(row => `<div class="plan-bill"><span><strong>${esc(row.note || row.category)}</strong><small>${esc(row.date)} · ${money(row.amount)}</small></span><button type="button" data-link-spending="${row.id}">Assign to this paycheck</button></div>`).join('') || '<p class="finance-hint">No unassigned spending in the browsed month.</p>'}</details><h3>Savings & debt activity</h3>${[...p.activity].sort((a,b) => b.date.localeCompare(a.date)).map(row => `<div class="plan-bill"><span><strong>${esc(row.accountName)} · ${esc(names[F.type(row, row.kind)])}</strong><small>${esc(row.date)}${row.note ? ' · ' + esc(row.note) : ''}</small></span><b class="money">${F.cash(row, row.kind) < 0 ? '−' : ''}${money(Math.abs(F.cash(row, row.kind)))}</b><button type="button" data-activity-edit="${row.kind}:${row.accountId}:${row.id}">Edit</button></div>`).join('') || '<p class="finance-hint">Link contributions and payments from their account cards.</p>'}<div class="finance-actions"><button type="button" data-go-view="goals">Open savings</button><button type="button" data-go-view="debt">Open debt</button></div></section>`
  const billOccurrence = (bill, month) => {
    const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()
    return { billId: bill.id, name: bill.name, amount: Number(bill.amount), date: month + '-' + String(Math.min(days, Number(bill.due))).padStart(2, '0') }
  }
  const render = () => {
    const s = state()
    $('#appShell').classList.toggle('paycheck-only', Boolean(s.ui.paycheckOnly))
    if (viewedMonth !== s.selectedMonth) { viewedMonth = s.selectedMonth; billMonth = viewedMonth; selectedPaycheck = s.paydays.find(row => row.date.startsWith(viewedMonth))?.id || '' }
    if (!s.paydays.some(row => row.id === selectedPaycheck)) selectedPaycheck = s.paydays.find(row => row.date.startsWith(viewedMonth))?.id || ''
    const p = F.plan(s, selectedPaycheck)
    const bills = s.bills.filter(bill => bill.frequency !== 'once' || bill.month === billMonth).sort((a, b) => a.due - b.due)
    $('#paycheckPlanner').innerHTML = `<div class="card-heading"><div><span class="eyebrow">GIVE EACH PAYCHECK A PLAN</span><h2>Paycheck budget</h2></div><button type="button" class="primary-button" data-new-paycheck>+ Paycheck</button></div><p class="finance-hint">One paycheck, one clear picture. Link bills, spending, savings and debt without duplicating transactions.</p><label class="check-row"><input type="checkbox" id="paycheckOnly"${s.ui.paycheckOnly ? ' checked' : ''}>Paycheck only · hide the monthly overview</label><label class="finance-select">Choose a saved paycheck<select id="planPaycheck">${payOptions(selectedPaycheck)}</select></label>${p.paycheck ? `${overview(p)}<h3>Budget allowances</h3><p class="finance-hint">Optional targets. Other is consumed by this paycheck’s linked spending.</p><form id="paycheckBudgetForm" class="paycheck-buckets"><label>Bills<output class="money">${money(p.buckets.bills)}</output><small>From assigned bills</small></label>${['debt', 'savings', 'other'].map(key => `<label>${key[0].toUpperCase() + key.slice(1)}<input aria-label="${key} budget" name="${key}" type="number" min="0" step="0.01" required value="${p.buckets[key]}"></label>`).join('')}<button class="primary-button" type="submit">Save plan</button></form>${paycheckActivity(p)}<details class="assigned-bills" open><summary>Assigned bills · ${p.bills.length}</summary>${p.bills.map(row => `<div class="plan-bill"><span><strong>${esc(row.name)}</strong><small>Due ${esc(row.date)} · saved allocation</small></span><b class="money">${money(row.amount)}</b><button type="button" data-unassign="${esc(row.date.slice(0, 7) + '/' + row.billId)}">Unassign</button></div>`).join('') || '<p class="finance-hint">Choose a paycheck beside a bill below to fund it.</p>'}</details>` : '<p class="empty-copy">Add a paycheck or select one above to start. Forecasts remain estimates until you save a dated paycheck.</p>'}<div class="card-heading finance-bill-heading"><div><h3>Bills in your Budget Plan</h3><p class="finance-hint">Each monthly bill can belong to one paycheck, including a paycheck from another month.</p></div><button type="button" data-go-view="bills">+ New bill</button></div><label class="finance-select">Bills due in<input id="planBillMonth" type="month" value="${esc(billMonth)}" required></label><div>${bills.map(bill => {
      const key = billMonth + '/' + bill.id; const assigned = s.billAssignments[key]; const paid = Boolean(bill.paidMonths?.[billMonth])
      return `<div class="plan-bill"><button class="bill-check" type="button" data-bill-toggle="${bill.id}" data-bill-month="${billMonth}" aria-label="Mark ${esc(bill.name)} ${paid ? 'open' : 'paid'}">${paid ? '✓' : ''}</button><span><strong>${esc(bill.name)}</strong><small>Due ${esc(billOccurrence(bill, billMonth).date)} · ${paid ? 'Paid' : 'Unpaid'}</small></span><b class="money">${money(bill.amount)}</b><label>Funded by<select aria-label="Paycheck for ${esc(bill.name)}" data-assign-bill="${bill.id}">${payOptions(assigned?.paycheckId)}</select></label></div>`
    }).join('') || '<p class="empty-copy">No bills due this month. Add one above.</p>'}</div><p class="finance-hint">Assigned amounts are saved snapshots. To use an edited bill amount, unassign it and assign it again. Paid status is tracked separately.</p>`
  }
  const openActivity = (kind, id, type, rowId = '') => {
    const account = accountFor(kind, id); if (!account) return
    const existing = F.rows(account, kind).find(row => row.id === rowId)
    if (rowId && !existing) return
    editing = { kind, id, type, rowId }
    const form = $('#activityForm'); form.reset()
    $('#activityTitle').textContent = (rowId ? 'Edit transaction · ' : '') + names[type] + ' · ' + account.name
    form.elements.date.value = existing?.date || today(); form.elements.date.max = today()
    // A correction records a delta today, never rewrites past balances.
    form.elements.date.readOnly = type === 'adjustment' && !rowId
    form.elements.amount.min = type === 'adjustment' ? (rowId ? '' : '0') : '0.01'
    form.elements.amount.value = existing ? existing.amount : type === 'adjustment' ? F.balance(account, kind) : ''
    form.elements.note.value = existing?.note || ''
    $('#activityAmountLabel').textContent = type === 'adjustment' ? (rowId ? 'Correction amount (signed difference)' : 'Correct balance as of today') : 'Amount'
    form.elements.paycheck.innerHTML = payOptions(existing?.paycheckId || '')
    const linkable = ['deposit', 'payment', 'return'].includes(type)
    form.elements.paycheck.disabled = !linkable; $('#activityPaycheckLabel').hidden = !linkable
    $('#activityHint').textContent = type === 'withdrawal' ? 'Reduces savings only. Do not log this again as everyday spending: savings deposits were already set aside.' : type === 'return' ? 'Moves savings back into this month’s available budget when “Keep deposits out” is enabled.' : type === 'adjustment' ? 'Records the difference as a dated correction. It does not count as income, spending or a payment.' : type === 'charge' ? 'Increases this account’s debt. It is not counted as income or a debt payment.' : 'Use the date the money moved. Linking a paycheck compares actual activity with your plan.'
    if (rowId && type === 'adjustment') $('#activityHint').textContent = 'Edit the signed correction, not the final balance. All later running balances are recalculated.'
    $('#activityError').textContent = ''; $('#activityDialog').showModal()
  }
  const openEdit = (kind, id) => {
    const account = accountFor(kind, id); if (!account) return
    editing = { kind, id }; const form = $('#accountEditForm'); form.reset()
    $('#accountEditTitle').textContent = kind === 'goal' ? 'Edit saving goal' : 'Edit debt account'
    form.elements.name.value = account.name
    $('#accountPrimaryLabel').textContent = kind === 'goal' ? 'Target amount' : 'APR (%)'
    form.elements.primary.min = kind === 'goal' ? '0.01' : '0'; form.elements.primary.value = kind === 'goal' ? account.target : account.apr
    $('#accountMonthlyLabel').textContent = kind === 'goal' ? 'Monthly saving plan' : 'Usual payment'
    form.elements.monthly.value = kind === 'goal' ? account.monthly : account.payment
    $('#accountEditDialog').showModal()
  }
  const commit = message => { state().profile.sampleData = false; save(); renderAll(); toast(message) }
  const bind = () => {
    document.addEventListener('input', event => {
      const form = event.target.closest('#paycheckBudgetForm')
      if (!form || !form.checkValidity() || !state().paydays.some(row => row.id === selectedPaycheck)) return
      const data = Object.fromEntries(new FormData(form))
      state().paycheckPlans[selectedPaycheck] = Object.fromEntries(['debt', 'savings', 'other'].map(key => [key, F.round(data[key])]))
      state().profile.sampleData = false; save()
      const p = F.plan(state(), selectedPaycheck)
      $('#paycheckOverview').outerHTML = overview(p)
    })
    document.addEventListener('click', event => {
      const activityEdit = event.target.closest('[data-activity-edit]')
      if (activityEdit) { const [kind, id, rowId] = activityEdit.dataset.activityEdit.split(':'); const account = accountFor(kind, id); const row = account && F.rows(account, kind).find(item => item.id === rowId); if (row) openActivity(kind, id, F.type(row, kind), rowId) }
      const spend = event.target.closest('[data-paycheck-spend]')
      if (spend) openExpense(today(), null, spend.dataset.paycheckSpend)
      const link = event.target.closest('[data-link-spending]')
      if (link && state().paydays.some(row => row.id === selectedPaycheck)) { const row = state().expenses.find(item => item.id === link.dataset.linkSpending); if (row) { row.paycheckId = selectedPaycheck; commit('Spending linked — no duplicate created') } }
      const activity = event.target.closest('[data-activity]'); if (activity) openActivity(...activity.dataset.activity.split(':'))
      const edit = event.target.closest('[data-account-edit]'); if (edit) openEdit(...edit.dataset.accountEdit.split(':'))
      const close = event.target.closest('[data-finance-close]'); if (close) close.closest('dialog').close()
      const unassign = event.target.closest('[data-unassign]'); if (unassign) { delete state().billAssignments[unassign.dataset.unassign]; commit('Bill unassigned') }
      if (event.target.closest('[data-new-paycheck]')) { const form = $('#newPaycheckForm'); form.reset(); form.elements.date.value = today(); $('#newPaycheckDialog').showModal() }
      const remove = event.target.closest('[data-activity-remove]')
      if (remove) {
        pendingDeletion = remove.dataset.activityRemove.split(':')
        $('#deleteActivityDialog').showModal()
      }
    })
    document.addEventListener('change', event => {
      if (event.target.id === 'paycheckOnly') { state().ui.paycheckOnly = event.target.checked; save(); render() }
      if (event.target.id === 'planPaycheck') { selectedPaycheck = event.target.value; render() }
      if (event.target.id === 'planBillMonth' && /^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) { billMonth = event.target.value; render() }
      if (event.target.matches('[data-assign-bill]')) {
        const bill = state().bills.find(row => row.id === event.target.dataset.assignBill); const key = billMonth + '/' + bill.id
        if (event.target.value) state().billAssignments[key] = { ...billOccurrence(bill, billMonth), paycheckId: event.target.value }
        else delete state().billAssignments[key]
        commit('Bill funding updated')
      }
    })
    document.addEventListener('submit', event => {
      if (event.target.id !== 'paycheckBudgetForm') return
      event.preventDefault(); const data = Object.fromEntries(new FormData(event.target))
      if (!state().paydays.some(row => row.id === selectedPaycheck)) return
      state().paycheckPlans[selectedPaycheck] = Object.fromEntries(['debt', 'savings', 'other'].map(key => [key, F.round(data[key])]))
      commit('Paycheck plan saved')
    })
    $('#newPaycheckForm').addEventListener('submit', event => {
      event.preventDefault(); const data = Object.fromEntries(new FormData(event.target))
      if (!F.validDate(data.date)) return
      const row = { id: uid(), name: data.name.trim(), date: data.date, amount: F.round(data.amount) }
      state().paydays.push(row); state().selectedMonth = row.date.slice(0, 7); viewedMonth = state().selectedMonth; billMonth = viewedMonth; selectedPaycheck = row.id
      $('#newPaycheckDialog').close(); commit('Paycheck added — ready to plan')
    })
    $('#confirmActivityDelete').addEventListener('click', () => {
      if (!pendingDeletion) return
      const [kind, id, rowId] = pendingDeletion; const account = accountFor(kind, id)
      pendingDeletion = null; $('#deleteActivityDialog').close(); if (!account) return
      const list = F.rows(account, kind); const index = list.findIndex(row => row.id === rowId); const removed = list[index]
      if (!removed) return
      try { F.validate(account, kind, list.filter(row => row.id !== rowId)) } catch (error) { toast(error.message); return }
      list.splice(index, 1); if (kind === 'debt') account.balance = F.balance(account, kind)
      commit('Transaction deleted'); toast('Transaction deleted', 'Undo', () => {
        const proposed = [...list]; proposed.splice(index, 0, removed)
        try { F.validate(account, kind, proposed) } catch (error) { toast(error.message); return }
        list.splice(index, 0, removed); if (kind === 'debt') account.balance = F.balance(account, kind); commit('Transaction restored')
      })
    })
    $('#activityForm').addEventListener('submit', event => {
      event.preventDefault(); const { kind, id, type, rowId } = editing; const account = accountFor(kind, id); if (!account) return
      const data = Object.fromEntries(new FormData(event.target)); const list = F.rows(account, kind)
      const row = { id: rowId || uid(), date: type === 'adjustment' && !rowId ? today() : data.date, type, amount: F.round(type === 'adjustment' && !rowId ? Number(data.amount) - F.balance(account, kind) : data.amount), note: data.note.trim(), paycheckId: data.paycheck || '' }
      try {
        if (row.date > today()) throw Error('Use today or an earlier transaction date.')
        if (type === 'adjustment' && row.amount === 0) throw Error('The balance is already this amount.')
        F.updateTransaction(account, kind, row, rowId)
        $('#activityDialog').close(); commit(rowId ? 'Transaction updated; all balances recalculated' : 'Transaction recorded')
      } catch (error) { $('#activityError').textContent = error.message }
    })
    $('#accountEditForm').addEventListener('submit', event => {
      event.preventDefault(); const { kind, id } = editing; const account = accountFor(kind, id); if (!account) return
      const data = Object.fromEntries(new FormData(event.target)); account.name = data.name.trim()
      if (kind === 'goal') { account.target = F.round(data.primary); account.monthly = F.round(data.monthly) }
      else { account.apr = Number(data.primary); account.payment = F.round(data.monthly) }
      $('#accountEditDialog').close(); commit('Account updated; transaction history preserved')
    })
  }
  const selectPaycheck = id => { if (state().paydays.some(row => row.id === id)) { selectedPaycheck = id; viewedMonth = state().selectedMonth; billMonth = viewedMonth } }
  return { render, bind, buttons, history, openActivity, openEdit, accountSummary, payOptions, selectPaycheck, balanceSeries, balanceChart, paycheckSegments, paycheckVisual }
}
