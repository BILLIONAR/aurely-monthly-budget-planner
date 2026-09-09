/* AurelyStudio · optional visual tools. Financial records remain the source of truth. */
;(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.BudgetExtras = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'
  const categories = ['Groceries', 'Home', 'Transport', 'Eating out', 'Fun', 'Other']
  const defaults = [
    { id: 'quick-coffee', name: 'Coffee', amount: 4, category: 'Eating out' },
    { id: 'quick-lunch', name: 'Lunch', amount: 12, category: 'Eating out' },
    { id: 'quick-transit', name: 'Transit', amount: 6, category: 'Transport' }
  ]
  const round = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100
  const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s + 'T12:00:00Z')) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s
  function validatePresets(rows) {
    if (!Array.isArray(rows) || rows.length > 12) throw Error('Use up to 12 quick spends.')
    const ids = new Set()
    for (const row of rows) {
      if (!row || typeof row.id !== 'string' || !/^[\w-]+$/.test(row.id) || ids.has(row.id) || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 40 || !categories.includes(row.category) || typeof row.amount !== 'number' || !Number.isFinite(row.amount) || row.amount <= 0 || row.amount > 100000000 || Math.abs(row.amount - round(row.amount)) > 0.000001) throw Error('Use a name, category and positive amount with up to two decimals.')
      ids.add(row.id)
    }
    return rows
  }
  function payoffEstimate(balance, apr, payment, asOf) {
    balance = Number(balance); apr = Number(apr); payment = Number(payment)
    if (![balance, apr, payment].every(Number.isFinite) || balance < 0 || apr < 0 || payment < 0 || !validDate(asOf)) return { status: 'invalid' }
    balance = round(balance); payment = round(payment)
    if (!balance) return { status: 'paid', months: 0, interest: 0 }
    if (!payment) return { status: 'no-payment' }
    let interest = 0
    for (let months = 1; months <= 1200; months++) {
      const charge = round(balance * apr / 1200)
      if (payment <= charge) return { status: 'insufficient' }
      interest = round(interest + charge); balance = round(Math.max(0, balance + charge - payment))
      if (balance === 0) {
        const date = new Date(asOf + 'T12:00:00Z'); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months)
        return { status: 'estimated', months, interest, month: date.toISOString().slice(0, 7) }
      }
    }
    return { status: 'long-term' }
  }
  function categoryComparison(state, month) {
    const map = new Map()
    const get = name => { if (!map.has(name)) map.set(name, { name, planned: null, actual: 0 }); return map.get(name) }
    for (const row of state.envelopes || []) { const entry = get(row.category); entry.planned = round((entry.planned || 0) + Number(row.cap || 0)) }
    for (const row of state.expenses || []) if (row.date.startsWith(month)) { const entry = get(row.category); entry.actual = round(entry.actual + Number(row.amount || 0)) }
    return [...map.values()].sort((a, b) => b.actual - a.actual || a.name.localeCompare(b.name))
  }
  function combinedLedger(state, month = '', type = '', query = '') {
    const rows = [
      ...(state.paydays || []).map(r => ({ ...r, kind: 'payday', type: 'income', label: r.name || 'Payday', category: 'Scheduled paycheck' })),
      ...(state.moneyIn || []).map(r => ({ ...r, kind: 'extra', type: 'income', label: r.name || r.note || 'Extra income', category: 'Extra income' })),
      ...(state.expenses || []).map(r => ({ ...r, kind: 'expense', type: 'spending', label: r.note || r.category }))
    ]
    const search = query.trim().toLowerCase()
    return rows.filter(r => (!month || r.date.startsWith(month)) && (!type || r.type === type) && (!search || `${r.date} ${r.label} ${r.category}`.toLowerCase().includes(search))).sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '') || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id))
  }
  function create({ getState, save, renderAll, money, formatMoney, esc, uid, today, toast, insightData }) {
    const $ = s => document.querySelector(s)
    let ledgerType = '', ledgerQuery = '', ledgerAll = false, ledgerLimit = 50
    let activeAnimations = [], countFrames = [], observer
    const seen = new Set()
    const quiet = () => getState().theme.calmMode || matchMedia('(prefers-reduced-motion: reduce)').matches
    const monthLabel = key => new Date(key + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    function stopMotion() {
      for (const animation of activeAnimations) animation.cancel()
      for (const item of countFrames) { cancelAnimationFrame(item.frame); if (item.el.isConnected) item.el.textContent = money(item.target) + item.suffix }
      activeAnimations = []; countFrames = []
    }
    function watch() {
      if (!('IntersectionObserver' in window)) return
      if (!observer) observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target; observer.unobserve(el)
          if (!el.isConnected || !el.getClientRects().length) continue
          const panel = el.closest('[data-view-panel]')?.dataset.viewPanel || 'shell'
          const key = `${getState().selectedMonth}:${panel}:${el.dataset.arrivalKey}`
          if (seen.has(key)) continue
          seen.add(key)
          if (quiet()) continue
          activeAnimations.push(el.animate([{ opacity: .3, transform: 'translateY(9px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 460, easing: 'cubic-bezier(.2,.7,.2,1)' }))
          for (const bar of el.querySelectorAll('.compare-track i, .statistics-track i, .rhythm-day > span, .flow-sectors')) {
            activeAnimations.push(bar.animate([{ transform: bar.matches('.rhythm-day > span') ? 'scaleY(0)' : bar.matches('.flow-sectors') ? 'rotate(-35deg) scale(.92)' : 'scaleX(0)', opacity: .35 }, { transform: 'none', opacity: 1 }], { duration: 680, easing: 'cubic-bezier(.2,.7,.2,1)' }))
          }
          if (!getState().privateMode) for (const el of entry.target.querySelectorAll('[data-money-value]')) {
            const target = Number(el.dataset.moneyValue), suffix = el.dataset.moneySuffix || ''; if (!Number.isFinite(target)) continue
            const job = { el, target, suffix, frame: 0 }, started = performance.now(); countFrames.push(job)
            function tick(t) {
              if (!el.isConnected || getState().privateMode || quiet()) { if (el.isConnected) el.textContent = money(target) + suffix; return }
              const p = Math.min(1, (t - started) / 680); el.textContent = formatMoney(round(target * (1 - Math.pow(1 - p, 3)))) + suffix
              if (p < 1) job.frame = requestAnimationFrame(tick)
            }
            job.frame = requestAnimationFrame(tick)
          }
        }
      }, { threshold: .08 })
      observer.disconnect()
      document.querySelectorAll('.metric-card, .flow-card, .statistics-card, .rhythm-card, .comparison-card').forEach((el, index) => {
        el.dataset.arrivalKey = el.id || `${el.className}:${index}`
        observer.observe(el)
      })
    }
    function comparison() {
      const host = $('#budgetComparison'); if (!host) return
      const state = getState(), rows = categoryComparison(state, state.selectedMonth), max = Math.max(1, ...rows.flatMap(r => [r.planned || 0, r.actual]))
      host.innerHTML = `<div class="card-heading"><div><span class="eyebrow">PLAN & REAL LIFE</span><h2>Planned vs. spent</h2></div><a href="#screen-envelopes" class="ghost-button small-button">Edit caps →</a></div><p>Current envelope caps compared with spending logged in ${esc(monthLabel(state.selectedMonth))}. Changing a cap also changes comparisons for past months.</p><div class="compare-key"><span><i></i>Planned cap</span><span><i></i>Logged spending</span></div><div class="compare-rows">${rows.map(r => `<section class="compare-row"><h3>${esc(r.name)}</h3><div><span>Planned</span><span class="compare-track"><i style="width:${state.privateMode ? 0 : (r.planned || 0) / max * 100}%"></i></span><strong class="money">${r.planned === null ? 'No cap' : money(r.planned)}</strong></div><div><span>Spent</span><span class="compare-track actual"><i style="width:${state.privateMode ? 0 : r.actual / max * 100}%"></i></span><strong class="money">${money(r.actual)}</strong></div><small>${r.planned === null ? 'Set a cap in Envelopes to compare.' : state.privateMode ? 'Difference hidden' : r.actual > r.planned ? `${money(r.actual - r.planned)} over cap` : `${money(r.planned - r.actual)} under cap`}</small></section>`).join('') || '<p class="empty-copy">Add an envelope cap or log spending to start your comparison.</p>'}</div><p class="finance-hint">Spending entries only. Bill schedules, savings transfers and debt activity stay in their own records. Caps for the same category are added together.</p>`
    }
    function ledger() {
      const host = $('#combinedLedgerRows'); if (!host) return
      const state = getState(), rows = combinedLedger(state, ledgerAll ? '' : state.selectedMonth, ledgerType, ledgerQuery)
      $('#ledgerPeriod').textContent = ledgerAll ? 'All saved dates' : monthLabel(state.selectedMonth)
      $('#ledgerCount').textContent = `${rows.length} records · showing ${Math.min(rows.length, ledgerLimit)}`
      host.innerHTML = rows.slice(0, ledgerLimit).map(r => `<tr><td>${esc(r.date)}</td><td><strong>${esc(r.label)}</strong><small>${esc(r.category)}</small></td><td>${r.type === 'income' ? 'Income' : 'Spending'}</td><td class="money">${money(r.amount)}</td><td><button type="button" class="ghost-button small-button" ${r.kind === 'expense' ? `data-expense-edit="${esc(r.id)}"` : `data-income-edit="${esc(r.kind)}:${esc(r.id)}"`} aria-label="Edit ${esc(r.label)} on ${esc(r.date)}">Edit</button></td></tr>`).join('') || '<tr><td colspan="5">No matching records. Try another filter or add money in / spending.</td></tr>'
      $('#ledgerMore').hidden = rows.length <= ledgerLimit
    }
    function presets() {
      const rows = getState().quickPresets || defaults
      $('.common-spends').innerHTML = rows.map(r => `<button type="button" data-quick-spend="${r.amount}" data-quick-category="${esc(r.category)}" data-quick-note="${esc(r.name)}">${esc(r.name)} <strong class="money">${money(r.amount)}</strong></button>`).join('') + '<button type="button" id="manageQuickSpends" class="manage-presets">Manage quick spends</button>'
    }
    function presetList() {
      $('#presetList').innerHTML = getState().quickPresets.map(r => `<div class="preset-row"><span><strong>${esc(r.name)}</strong><small>${esc(r.category)} · ${money(r.amount)}</small></span><button type="button" class="ghost-button small-button" data-preset-edit="${esc(r.id)}" aria-label="Edit ${esc(r.name)}">Edit</button><button type="button" class="ghost-button small-button" data-preset-delete="${esc(r.id)}" aria-label="Remove ${esc(r.name)}">Remove</button></div>`).join('') || '<p>No quick spends yet. Add your first shortcut below.</p>'
    }
    function debtMarkup(debt) {
      const state = getState(), estimate = payoffEstimate(debt.balance, debt.apr, debt.payment, today())
      const titles = { paid: 'Balance paid off', 'no-payment': 'Add a usual monthly payment', insufficient: 'Payment does not cover monthly interest', 'long-term': 'More than 100 years at this payment', invalid: 'Check the balance, APR and payment' }
      return `<aside class="payoff-estimate"><span class="eyebrow">PAYOFF ESTIMATE</span><strong>${state.privateMode ? 'Estimate hidden' : estimate.status === 'estimated' ? esc(monthLabel(estimate.month)) : titles[estimate.status]}</strong>${!state.privateMode && estimate.status === 'estimated' ? `<p>${estimate.months} monthly payments · about <span class="money">${money(estimate.interest)}</span> interest.</p>` : ''}<details><summary>Estimate assumptions</summary><p>Uses the current balance, fixed APR ÷ 12 and your usual payment each month, starting next month. Interest is rounded to cents. Assumes no new charges, fees or rate changes. Your lender’s timing and daily interest may differ. This estimate never adds interest or payments to your records.</p></details></aside>`
    }
    function goalMarkup(goal) {
      if (!validDate(goal.targetDate)) return '<p class="goal-deadline">No target date · add one in Edit account.</p>'
      const days = Math.round((Date.parse(goal.targetDate + 'T12:00:00Z') - Date.parse(today() + 'T12:00:00Z')) / 86400000)
      return `<p class="goal-deadline"><strong>Target: ${esc(new Date(goal.targetDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}</strong><span>${days < 0 ? `${-days} days past target` : days === 0 ? 'Target is today' : `${days} days to go`} · your date, no automatic transfers.</span></p>`
    }
    function rings() {
      for (const host of document.querySelectorAll('.money-insights')) {
        const ring = host.querySelector('.flow-ring'); if (!ring) continue
        ring.querySelector('.flow-sectors')?.remove()
        const state = getState(), data = insightData(state.selectedMonth)
        if (state.privateMode || !data.total) continue
        let offset = 0
        ring.classList.add('interactive-ring'); ring.removeAttribute('role'); ring.setAttribute('aria-label', 'Monthly plan distribution. Focus or tap a segment for its amount.')
        const groups = [...data.groups, { id: 'left', label: 'Plan left', amount: Math.max(0, data.left), color: 'var(--line)' }]
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 200 200'); svg.classList.add('flow-sectors')
        for (const row of groups.filter(r => r.amount > 0)) {
          const share = row.amount / data.total * 100, circle = document.createElementNS(svg.namespaceURI, 'circle')
          for (const [k, v] of Object.entries({ cx: 100, cy: 100, r: 88, fill: 'none', stroke: row.color, 'stroke-width': 15, pathLength: 100, 'stroke-dasharray': `${share} ${100 - share}`, 'stroke-dashoffset': -offset, tabindex: 0, role: 'button', 'aria-label': `${row.label}: ${money(row.amount)}. ${Math.round(share)}% of distribution.` })) circle.setAttribute(k, v)
          offset += share
          const show = () => { ring.querySelector('small').textContent = row.label; ring.querySelector('strong').textContent = money(row.amount); ring.querySelector('div > span').textContent = `${Math.round(share)}% of distribution`; circle.classList.add('highlight') }
          const reset = () => { circle.classList.remove('highlight'); ring.querySelector('small').textContent = data.left < 0 ? 'OVER PLAN' : 'PLAN LEFT'; ring.querySelector('strong').textContent = money(Math.abs(data.left)); ring.querySelector('div > span').textContent = 'after plans & activity' }
          circle.addEventListener('pointerenter', show); circle.addEventListener('pointerleave', () => { if (document.activeElement !== circle) reset() }); circle.addEventListener('focus', show); circle.addEventListener('blur', reset)
          circle.addEventListener('click', () => { circle.focus(); show() }); circle.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show() } if (e.key === 'Escape') { circle.blur(); reset() } })
          svg.append(circle)
        }
        ring.prepend(svg)
        const amount = ring.querySelector('strong')
        const fit = () => { amount.style.fontSize = `clamp(.7rem, ${16 / Math.max(8, amount.textContent.length)}rem, 1.55rem)` }
        fit(); svg.addEventListener('focusin', fit); svg.addEventListener('focusout', fit); svg.addEventListener('pointerover', fit); svg.addEventListener('pointerout', fit)
      }
    }
    function bind() {
      document.addEventListener('click', event => {
        if (event.target.closest('#manageQuickSpends')) { $('#presetForm').reset(); $('#presetForm [name="id"]').value = ''; $('#presetSave').textContent = 'Add quick spend'; presetList(); $('#presetDialog').showModal() }
        if (event.target.closest('#presetClose')) $('#presetDialog').close()
        const edit = event.target.closest('[data-preset-edit]'), remove = event.target.closest('[data-preset-delete]')
        if (edit) { const r = getState().quickPresets.find(r => r.id === edit.dataset.presetEdit); if (r) { const form = $('#presetForm'); for (const key of ['id','name','amount','category']) form.elements[key].value = r[key]; $('#presetSave').textContent = 'Save quick spend'; form.elements.name.focus() } }
        if (remove) { const rows = getState().quickPresets, index = rows.findIndex(r => r.id === remove.dataset.presetDelete); if (index < 0) return; const [row] = rows.splice(index, 1); save(); renderAll(); presetList(); $('#presetForm').reset(); $('#presetForm [name="id"]').value = ''; $('#presetSave').textContent = 'Add quick spend'; toast('Quick spend removed', 'Undo', () => { getState().quickPresets.splice(index, 0, row); save(); renderAll(); presetList() }) }
        if (event.target.closest('#ledgerMore')) { ledgerLimit += 50; ledger() }
        if (event.target.closest('#presetCancelEdit')) { $('#presetForm').reset(); $('#presetForm [name="id"]').value = ''; $('#presetSave').textContent = 'Add quick spend'; $('#presetError').textContent = '' }
      })
      $('#presetForm').addEventListener('submit', event => {
        event.preventDefault(); const form = event.currentTarget, data = Object.fromEntries(new FormData(form)), rows = getState().quickPresets.slice(), row = { id: data.id || uid(), name: data.name.trim(), amount: Number(data.amount), category: data.category }, index = rows.findIndex(r => r.id === row.id)
        if (index < 0) rows.push(row); else rows[index] = row
        try { validatePresets(rows) } catch (error) { $('#presetError').textContent = error.message; return }
        getState().quickPresets = rows; save(); renderAll(); presetList(); form.reset(); form.elements.id.value = ''; $('#presetSave').textContent = 'Add quick spend'; $('#presetError').textContent = ''; toast('Quick spends updated')
      })
      $('#ledgerSearch').addEventListener('input', e => { ledgerQuery = e.target.value; ledgerLimit = 50; ledger() })
      $('#ledgerType').addEventListener('change', e => { ledgerType = e.target.value; ledgerLimit = 50; ledger() })
      $('#ledgerAll').addEventListener('change', e => { ledgerAll = e.target.checked; ledgerLimit = 50; ledger() })
      document.addEventListener('change', () => queueMicrotask(() => { if (quiet()) stopMotion() }))
      matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => { if (quiet()) stopMotion() })
    }
    return { bind, debtMarkup, goalMarkup, enter: watch, refreshCharts() { stopMotion(); rings(); watch() }, render() { stopMotion(); comparison(); ledger(); presets(); rings(); watch() } }
  }
  return { defaults, validDate, validatePresets, payoffEstimate, categoryComparison, combinedLedger, create }
})
