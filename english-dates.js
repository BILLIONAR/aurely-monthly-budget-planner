/* English date controls; stored values remain ISO and independent of browser locale. */
(function (root) {
  'use strict'
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const days = (year, month) => { const date = new Date(0); date.setUTCFullYear(year, month, 0); return date.getUTCDate() }
  const format = (value, kind) => {
    if (!valid(value, kind)) return kind === 'month' ? 'Choose month' : 'Choose date'
    const [year, month, day] = value.split('-').map(Number)
    return `${months[month - 1]}${kind === 'date' ? ' ' + day + ',' : ''} ${year}`
  }
  const valid = (value, kind) => {
    if (!(kind === 'month' ? /^\d{4}-(0[1-9]|1[0-2])$/ : /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/).test(value || '')) return false
    const [year, month, day] = value.split('-').map(Number)
    return year >= 1 && (kind === 'month' || day >= 1 && day <= days(year, month))
  }
  function install() {
    const doc = root.document; const bindings = new Map(); let active
    const dialog = doc.createElement('dialog'); dialog.id = 'englishDateDialog'; dialog.className = 'english-date-dialog'
    dialog.setAttribute('aria-labelledby', 'englishDateTitle')
    dialog.innerHTML = '<div class="english-date-shell"><h2 id="englishDateTitle">Choose date</h2><div class="english-date-fields"><label>Month<select id="englishMonth"></select></label><label>Year<input id="englishYear" type="number" min="1" max="9999" step="1"></label><label id="englishDayLabel">Day<select id="englishDay"></select></label></div><p id="englishDateError" role="alert"></p><div class="finance-actions"><button type="button" id="englishDateCancel">Cancel</button><button type="button" id="englishDateClear">Clear</button><button type="button" class="primary-button" id="englishDateApply">Apply date</button></div></div>'
    doc.body.append(dialog)
    const $ = id => doc.getElementById(id)
    $('englishMonth').innerHTML = months.map((name, index) => `<option value="${index + 1}">${name}</option>`).join('')
    const updateDays = () => { const old = Number($('englishDay').value) || 1; const count = days(Number($('englishYear').value) || 2000, Number($('englishMonth').value)); $('englishDay').innerHTML = Array.from({length:count}, (_, i) => `<option value="${i+1}">${i+1}</option>`).join(''); $('englishDay').value = String(Math.min(old, count)) }
    const open = input => {
      active = input; const date = new Date(); const parts = valid(input.value, input.dataset.calendarKind) ? input.value.split('-').map(Number) : [date.getFullYear(), date.getMonth()+1, date.getDate()]
      $('englishDateTitle').textContent = input.dataset.calendarLabel || 'Choose date'; $('englishYear').value = parts[0]; $('englishMonth').value = parts[1]; updateDays(); $('englishDay').value = String(Math.min(parts[2] || 1, days(parts[0],parts[1])))
      $('englishDayLabel').hidden = input.dataset.calendarKind === 'month'; $('englishDateClear').hidden = input.dataset.calendarRequired === 'true'; $('englishDateError').textContent = ''; dialog.showModal(); $('englishMonth').focus()
    }
    const enhance = () => {
      for (const [input, button] of bindings) { if (!input.isConnected) { bindings.delete(input); continue } const label = format(input.value, input.dataset.calendarKind); if (button.textContent !== label) button.textContent = label; const disabled = input.disabled || input.readOnly; if (button.disabled !== disabled) button.disabled = disabled }
      doc.querySelectorAll('input[type="date"], input[type="month"]').forEach(input => {
        const kind = input.type; const label = input.labels?.[0]?.textContent.trim() || input.getAttribute('aria-label') || (kind === 'month' ? 'Choose month' : 'Choose date')
        input.dataset.calendarKind = kind; input.dataset.calendarRequired = String(input.required); input.dataset.calendarLabel = label; input.type = 'hidden'; input.required = false
        const button = doc.createElement('button'); button.type = 'button'; button.className = 'english-date-trigger'; button.setAttribute('aria-label', label); button.setAttribute('aria-haspopup','dialog'); button.textContent = format(input.value, kind)
        input.insertAdjacentElement('afterend', button); bindings.set(input, button); button.addEventListener('click', () => open(input))
      })
    }
    $('englishYear').addEventListener('input', updateDays); $('englishMonth').addEventListener('change', updateDays)
    $('englishDateCancel').addEventListener('click', () => dialog.close())
    const apply = value => { active.value = value; active.dispatchEvent(new Event('input', {bubbles:true})); active.dispatchEvent(new Event('change', {bubbles:true})); dialog.close(); enhance() }
    $('englishDateClear').addEventListener('click', () => apply(''))
    $('englishDateApply').addEventListener('click', () => {
      const year = Number($('englishYear').value); const kind = active.dataset.calendarKind
      const value = String(year).padStart(4,'0') + '-' + $('englishMonth').value.padStart(2,'0') + (kind === 'date' ? '-' + $('englishDay').value.padStart(2,'0') : '')
      if (!Number.isInteger(year) || year < 1 || year > 9999 || !valid(value,kind)) { $('englishDateError').textContent = 'Choose a valid date and a year from 1 to 9999.'; return }
      if (active.min && value < active.min || active.max && value > active.max) { $('englishDateError').textContent = `Choose ${active.min ? 'on or after ' + format(active.min,kind) : ''}${active.min && active.max ? ' and ' : ''}${active.max ? 'on or before ' + format(active.max,kind) : ''}.`; return }
      apply(value)
    })
    doc.addEventListener('submit', event => {
      const bad = [...event.target.querySelectorAll('input[data-calendar-kind]')].find(input => !input.disabled && ((input.dataset.calendarRequired === 'true' && !input.value) || input.value && (!valid(input.value, input.dataset.calendarKind) || input.min && input.value < input.min || input.max && input.value > input.max)))
      if (bad) { event.preventDefault(); event.stopImmediatePropagation(); open(bad); $('englishDateError').textContent = 'Choose a valid date before saving.' }
    }, true)
    new MutationObserver(enhance).observe(doc.body, {childList:true,subtree:true,attributes:true,attributeFilter:['open','value','disabled','readonly']})
    enhance(); return { enhance }
  }
  const api = { months, days, format, valid, install }
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.EnglishDates = api
})(globalThis)
