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
    dialog.innerHTML = '<div class="english-date-shell"><h2 id="englishDateTitle">Choose date</h2><div class="english-date-fields"><label>Month<select id="englishMonth"></select></label><label>Year<input id="englishYear" type="number" min="1" max="9999" step="1"></label><label id="englishDayLabel">Day<select id="englishDay"></select></label></div><div id="englishCalendar" class="date-calendar"><div class="date-calendar-nav"><button type="button" id="englishPrev" aria-label="Previous month">←</button><strong id="englishCalendarMonth" aria-live="polite"></strong><button type="button" id="englishNext" aria-label="Next month">→</button></div><div class="date-weekdays" aria-hidden="true"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div id="englishCalendarDays" class="date-calendar-days" role="group" aria-label="Days of month"></div><button type="button" id="englishToday" class="ghost-button">Today</button><small>Choose a day, then Apply date. Arrow keys move by day or week.</small></div><p id="englishDateError" role="alert"></p><div class="finance-actions"><button type="button" id="englishDateCancel">Cancel</button><button type="button" id="englishDateClear">Clear</button><button type="button" class="primary-button" id="englishDateApply">Apply date</button></div></div>'
    doc.body.append(dialog)
    const $ = id => doc.getElementById(id)
    $('englishMonth').innerHTML = months.map((name, index) => `<option value="${index + 1}">${name}</option>`).join('')
    const renderCalendar = () => {
      const year = Number($('englishYear').value), month = Number($('englishMonth').value), selected = Number($('englishDay').value)
      if (!Number.isInteger(year) || year < 1 || year > 9999) return
      const first = new Date(0); first.setUTCFullYear(year, month-1, 1)
      const today = new Date(); const todayValue = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
      $('englishCalendarMonth').textContent = `${months[month-1]} ${year}`
      $('englishCalendarDays').innerHTML = '<span aria-hidden="true"></span>'.repeat(first.getUTCDay()) + Array.from({length:days(year,month)}, (_, i) => {
        const day = i+1, value = `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
        const disabled = active && ((active.min && value < active.min) || (active.max && value > active.max))
        return `<button type="button" data-pick-day="${day}" aria-label="${format(value,'date')}" aria-pressed="${day===selected}"${value===todayValue?' aria-current="date"':''}${disabled?' disabled':''}>${day}</button>`
      }).join('')
      $('englishPrev').disabled = year===1 && month===1; $('englishNext').disabled = year===9999 && month===12
    }
    const updateDays = () => { const old = Number($('englishDay').value) || 1; const count = days(Number($('englishYear').value) || 2000, Number($('englishMonth').value)); $('englishDay').innerHTML = Array.from({length:count}, (_, i) => `<option value="${i+1}">${i+1}</option>`).join(''); $('englishDay').value = String(Math.min(old, count)); renderCalendar() }
    const shiftMonth = amount => { let year = Number($('englishYear').value), month = Number($('englishMonth').value) + amount; if (month < 1) { month=12; year-- } if (month > 12) { month=1; year++ } if (year < 1 || year > 9999) return; $('englishYear').value=year; $('englishMonth').value=month; updateDays() }
    $('englishPrev').addEventListener('click', () => shiftMonth(-1)); $('englishNext').addEventListener('click', () => shiftMonth(1))
    $('englishCalendarDays').addEventListener('click', event => { const button=event.target.closest('[data-pick-day]'); if (button && !button.disabled) { $('englishDay').value=button.dataset.pickDay; renderCalendar(); $('englishCalendarDays').querySelector(`[data-pick-day="${button.dataset.pickDay}"]`).focus() } })
    $('englishCalendarDays').addEventListener('keydown', event => {
      const button=event.target.closest('[data-pick-day]'); const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key]; if (!button || !delta) return
      event.preventDefault(); const date=new Date(0); date.setUTCFullYear(Number($('englishYear').value),Number($('englishMonth').value)-1,Number(button.dataset.pickDay)+delta)
      if(date.getUTCFullYear()<1 || date.getUTCFullYear()>9999) return
      $('englishYear').value=date.getUTCFullYear(); $('englishMonth').value=date.getUTCMonth()+1; updateDays(); $('englishDay').value=date.getUTCDate(); renderCalendar(); $('englishCalendarDays').querySelector(`[data-pick-day="${date.getUTCDate()}"]`)?.focus()
    })
    $('englishToday').addEventListener('click', () => { const now=new Date(); $('englishYear').value=now.getFullYear(); $('englishMonth').value=now.getMonth()+1; updateDays(); $('englishDay').value=now.getDate(); renderCalendar() })
    dialog.addEventListener('close', () => { bindings.get(active)?.focus() })
    const open = input => {
      active = input; const date = new Date(); const parts = valid(input.value, input.dataset.calendarKind) ? input.value.split('-').map(Number) : [date.getFullYear(), date.getMonth()+1, date.getDate()]
      $('englishDateTitle').textContent = input.dataset.calendarLabel || 'Choose date'; $('englishYear').value = parts[0]; $('englishMonth').value = parts[1]; updateDays(); $('englishDay').value = String(Math.min(parts[2] || 1, days(parts[0],parts[1])))
      $('englishDayLabel').hidden = true; $('englishCalendar').hidden = input.dataset.calendarKind === 'month'; renderCalendar(); $('englishDateClear').hidden = input.dataset.calendarRequired === 'true'; $('englishDateError').textContent = ''; dialog.showModal(); $('englishMonth').focus()
    }
    const enhance = () => {
      for (const [input, button] of bindings) { if (!input.isConnected) { bindings.delete(input); continue } const label = format(input.value, input.dataset.calendarKind); if (button.textContent !== label) button.textContent = label; const disabled = input.disabled || input.readOnly; if (button.disabled !== disabled) button.disabled = disabled }
      doc.querySelectorAll('input[type="date"], input[type="month"]').forEach(input => {
        const kind = input.type; const label = (input.labels?.[0]?.querySelector('span')?.textContent || input.labels?.[0]?.childNodes[0]?.textContent)?.trim() || input.getAttribute('aria-label') || (kind === 'month' ? 'Choose month' : 'Choose date')
        input.dataset.calendarKind = kind; input.dataset.calendarRequired = String(input.required); input.dataset.calendarLabel = label; input.type = 'hidden'; input.required = false
        const button = doc.createElement('button'); button.type = 'button'; button.className = 'english-date-trigger'; button.setAttribute('aria-label', label); button.setAttribute('aria-haspopup','dialog'); button.textContent = format(input.value, kind); button.disabled = input.disabled || input.readOnly
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
