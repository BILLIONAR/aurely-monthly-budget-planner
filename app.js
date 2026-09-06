(() => {
  'use strict'

  const STORAGE_KEY = 'aurely-monthly-budget-planner-prototype-v2'
  const VERSION = 10
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const SHORT_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const TAB_COLORS = ['#f39a8f', '#f4bc62', '#9fd2a7', '#72c9cf', '#f1cf59', '#f28d73', '#b39cdd', '#83afe2', '#78c29a', '#efa957', '#d98dae', '#69b5bd']
  const CATEGORIES = ['Groceries', 'Home', 'Transport', 'Eating out', 'Fun', 'Other']
  const VIEW_META = {
    today: ['◌', 'Today'], month: ['▦', 'Planner'], bills: ['⌁', 'Bills'], income: ['↗', 'Money in'],
    goals: ['◎', 'Goals'], debt: ['↘', 'Debt'], envelopes: ['▱', 'Envelopes'], milestones: ['◇', 'Milestones'],
    theme: ['✦', 'Theme Studio'], settings: ['⚙', 'Settings'], help: ['?', 'How it works']
  }
  let now = new Date()
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const monthKey = (date = new Date()) => dateKey(date).slice(0, 7)
  let currentDate = dateKey(now)
  let currentMonth = monthKey(now)
  let journalDate = currentDate
  let editingMonthNote = null
  const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const clone = (value) => JSON.parse(JSON.stringify(value))
  const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
  const makeDate = (month, day) => `${month}-${String(day).padStart(2, '0')}`
  const parseDate = (value) => new Date(`${value}T12:00:00`)
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
  const readableDate = (value, options = { month: 'short', day: 'numeric' }) => parseDate(value).toLocaleDateString('en-US', options)

  const baseTheme = {
    main: '#397382', accent: '#ef8c68', canvas: '#f8f2e9', bodyFont: 'Nunito Sans',
    headingFont: 'Cormorant Garamond', handwritingFont: 'Kalam', handScope: 'accents', nightMode: false, calmMode: false
  }
  const starterState = {
    version: VERSION, selectedMonth: currentMonth, selectedDate: currentDate, currency: 'USD', income: 4600, privateMode: false,
    bills: [
      { id: 'bill-rent', name: 'Rent', due: 1, amount: 1240, paid: true, frequency: 'monthly', autopay: true },
      { id: 'bill-electric', name: 'Electricity', due: 8, amount: 92, paid: false, frequency: 'monthly', autopay: false },
      { id: 'bill-phone', name: 'Phone', due: 16, amount: 48, paid: false, frequency: 'monthly', autopay: true },
      { id: 'bill-internet', name: 'Internet', due: 22, amount: 64, paid: false, frequency: 'monthly', autopay: false }
    ],
    expenses: [
      { id: 'expense-grocery', date: makeDate(currentMonth, Math.min(now.getDate(), 2)), time: '17:30', amount: 86.4, category: 'Groceries', note: 'Weekly shop' },
      { id: 'expense-coffee', date: makeDate(currentMonth, Math.min(now.getDate(), 3)), time: '10:15', amount: 8.75, category: 'Eating out', note: 'Coffee with a friend' }
    ],
    paydays: [
      { id: 'payday-one', date: makeDate(currentMonth, 14), amount: 2300, name: 'Payday' },
      { id: 'payday-two', date: makeDate(currentMonth, 28), amount: 2300, name: 'Payday' }
    ],
    moneyIn: [],
    goals: [
      { id: 'goal-buffer', name: 'Just-in-case fund', target: 1600, saved: 780, monthly: 100, keepOut: true, contributions: [] },
      { id: 'goal-weekend', name: 'Slow weekend away', target: 720, saved: 245, monthly: 45, keepOut: true, contributions: [] }
    ],
    debts: [{ id: 'debt-card', name: 'Blue card', startingBalance: 980, balance: 980, apr: 19.9, payment: 75, history: [] }],
    envelopes: [
      { id: 'env-grocery', name: 'Food at home', category: 'Groceries', cap: 420 },
      { id: 'env-fun', name: 'Fun money', category: 'Fun', cap: 160 }
    ],
    brainDump: [], notes: {}, monthNotes: {}, intention: '', dailyIntentions: {}, noSpendDays: [],
    profile: { name: '', title: 'My money plan', checking: 0, setAside: 0, usualPaycheck: 0, payCycle: 'biweekly', payAnchor: '', weekendEarly: false, depth: 'full', sampleData: true, sampleDismissed: false },
    ui: { helpMode: true, focusMode: false, milestoneFilter: 'all', agendaOpen: true, helpSection: 'start', printMonth: currentMonth, printAllHistory: false, printPaycheck: '', paperSize: 'A4', inkSaver: false, printSections: { summary: true, calendar: true, spending: true, goals: false, debt: false, notes: false, paychecks: true, history: true } },
    milestones: { reached: {} }, theme: clone(baseTheme)
  }
  const blankState = () => ({
    ...clone(starterState), income: 0, incomeByMonth: {}, bills: [], expenses: [], paydays: [], moneyIn: [], goals: [], debts: [], envelopes: [], brainDump: [], notes: {}, intention: '', noSpendDays: [],
    profile: { ...clone(starterState.profile), sampleData: false, sampleDismissed: true, title: 'My money plan' }, milestones: { reached: {} }
  })
  const mergeState = (saved) => {
    if (!saved || typeof saved !== 'object') saved = clone(starterState)
    const merged = {
      ...clone(starterState), ...saved, version: VERSION,
      bills: Array.isArray(saved.bills) ? saved.bills.map((item) => ({ frequency: 'monthly', autopay: false, ...item })) : clone(starterState.bills),
      expenses: Array.isArray(saved.expenses) ? saved.expenses.map((item) => ({ time: '', category: 'Other', note: '', ...item })) : clone(starterState.expenses),
      paydays: Array.isArray(saved.paydays) ? saved.paydays : clone(starterState.paydays), moneyIn: Array.isArray(saved.moneyIn) ? saved.moneyIn : [],
      goals: Array.isArray(saved.goals) ? saved.goals.map((item) => ({ monthly: 0, keepOut: true, contributions: [], ...item })) : clone(starterState.goals),
      debts: Array.isArray(saved.debts) ? saved.debts.map((item) => ({ startingBalance: num(item.balance), apr: 0, payment: 0, history: [], ...item })) : clone(starterState.debts),
      envelopes: Array.isArray(saved.envelopes) ? saved.envelopes : clone(starterState.envelopes), brainDump: Array.isArray(saved.brainDump) ? saved.brainDump : [],
      notes: saved.notes && typeof saved.notes === 'object' ? saved.notes : {}, profile: { ...clone(starterState.profile), ...(saved.profile || {}) },
      dailyIntentions: saved.dailyIntentions && typeof saved.dailyIntentions === 'object' && !Array.isArray(saved.dailyIntentions) ? clone(saved.dailyIntentions) : {},
      monthNotes: saved.monthNotes && typeof saved.monthNotes === 'object' && !Array.isArray(saved.monthNotes) ? clone(saved.monthNotes) : {},
      ui: { ...clone(starterState.ui), ...(saved.ui || {}), printSections: { ...starterState.ui.printSections, ...(saved.ui?.printSections || {}) } },
      milestones: { reached: { ...(saved.milestones?.reached || {}) } },
      theme: { ...baseTheme, ...(saved.theme || {}) }
    }
    delete merged.game // Retired XP data is not restored or included in future backups.
    if (!saved.profile) {
      merged.profile.sampleData = false
      merged.profile.sampleDismissed = true
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(merged.selectedMonth)) merged.selectedMonth = currentMonth
    if (!/^\d{4}-\d{2}-\d{2}$/.test(merged.selectedDate)) merged.selectedDate = `${merged.selectedMonth}-01`
    if (num(saved.version) < 7) merged.profile.depth = 'full'
    // Legacy paid flags had no date. Preserve them in the saved month only.
    merged.bills = merged.bills.map((bill) => ({ ...bill, paidMonths: bill.paidMonths && typeof bill.paidMonths === 'object' ? { ...bill.paidMonths } : (bill.paid ? { [bill.month || merged.selectedMonth]: true } : {}) }))
    const legacyIncomeMonth = saved.paydays?.[0]?.date?.slice(0, 7) || merged.selectedMonth
    const hasDatedIncome = [...merged.paydays, ...merged.moneyIn].some((row) => String(row.date).startsWith(legacyIncomeMonth))
    merged.incomeByMonth = saved.incomeByMonth && typeof saved.incomeByMonth === 'object' ? { ...saved.incomeByMonth } : (num(saved.income) && !hasDatedIncome ? { [legacyIncomeMonth]: num(saved.income) } : {})
    merged.noSpendDays = Array.isArray(saved.noSpendDays) ? saved.noSpendDays.filter((day) => typeof day === 'string') : []
    return BudgetFinance.migrate(merged)
  }

  let state
  try { state = mergeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')) } catch { state = mergeState(null) }
  // Focus is a deliberate session action; never reopen a mysteriously dimmed app.
  state.ui.focusMode = false
  let activeView = 'today'
  let toastTimer
  let noteTimer
  let undoCallback = null
  let commandItems = []
  let commandIndex = 0
  let installPrompt = null
  let launchTimers = []
  let launchReturnFocus = null
  const moneyAnimations = new WeakMap()
  const LAUNCH_SEEN_KEY = 'aurely-monthly-budget-launch-seen-v1'

  const $ = (selector, root = document) => root.querySelector(selector)
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]
  const appShell = $('#appShell')
  const sidebar = $('#sidebar')
  const quickDialog = $('#quickDialog')
  const commandDialog = $('#commandDialog')
  const helpDialog = $('#helpDialog')
  const launchScreen = $('#launchScreen')
  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: state.currency, maximumFractionDigits: num(value) % 1 ? 2 : 0 }).format(num(value))
  const masked = (value) => state.privateMode ? '••••' : money(value)
  const setAnimatedMoney = (selector, value, suffix = '') => {
    const element = $(selector); if (!element) return
    const target = num(value); const previous = Number(element.dataset.moneyValue); element.dataset.moneyValue = String(target)
    const activeFrame = moneyAnimations.get(element); if (activeFrame) cancelAnimationFrame(activeFrame)
    if (state.privateMode) { element.textContent = `••••${suffix}`; element.classList.remove('money-ticking'); return }
    const reduced = state.theme.calmMode || matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || !Number.isFinite(previous) || Math.abs(previous - target) < .005) { element.textContent = `${money(target)}${suffix}`; element.classList.remove('money-ticking'); return }
    const started = performance.now(); const duration = 620; element.classList.add('money-ticking')
    const tick = (time) => {
      const progress = clamp((time - started) / duration, 0, 1); const eased = 1 - Math.pow(1 - progress, 3); const current = previous + (target - previous) * eased
      element.textContent = `${money(Math.round(current * 100) / 100)}${suffix}`
      if (progress < 1) moneyAnimations.set(element, requestAnimationFrame(tick)); else { element.textContent = `${money(target)}${suffix}`; element.classList.remove('money-ticking'); moneyAnimations.delete(element) }
    }
    moneyAnimations.set(element, requestAnimationFrame(tick))
  }
  const parts = (key = state.selectedMonth) => { const [year, month] = key.split('-').map(Number); return { year, month, monthIndex: month - 1 } }
  const daysInMonth = (key = state.selectedMonth) => { const { year, month } = parts(key); return new Date(year, month, 0).getDate() }
  const billsFor = (key = state.selectedMonth) => state.bills.filter((bill) => bill.frequency !== 'once' || !bill.month || bill.month === key).map((bill) => ({ ...bill, due: Math.min(num(bill.due), daysInMonth(key)), paid: Boolean(bill.paidMonths?.[key]) }))
  const expensesFor = (key = state.selectedMonth) => state.expenses.filter((item) => String(item.date).startsWith(key))
  const adjustedPayday = (date) => {
    const copy = new Date(date); if (!state.profile.weekendEarly) return copy
    if (copy.getDay() === 6) copy.setDate(copy.getDate() - 1)
    if (copy.getDay() === 0) copy.setDate(copy.getDate() - 2)
    return copy
  }
  const forecastPaydaysFor = (key = state.selectedMonth) => {
    const amount = num(state.profile.usualPaycheck); const cycle = state.profile.payCycle || 'biweekly'; const anchor = state.profile.payAnchor
    if (amount <= 0 || cycle === 'irregular') return []
    const { year, monthIndex } = parts(key); const results = []; const add = (date) => { const adjusted = adjustedPayday(date); const dateValue = dateKey(adjusted); if (dateValue.startsWith(key)) results.push({ id: `forecast-${dateValue}`, date: dateValue, amount, name: 'Payday forecast', forecast: true }) }
    if (cycle === 'twice-monthly') {
      for (let offset = 0; offset <= 1; offset += 1) { add(new Date(year, monthIndex + offset, 15, 12)); add(new Date(year, monthIndex + offset + 1, 0, 12)) }
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor || '') || !Number.isFinite(parseDate(anchor).getTime())) return []
      if (cycle === 'monthly') {
        const anchorDay = Number(anchor.slice(-2))
        for (let offset = 0; offset <= 1; offset += 1) { const lastDay = new Date(year, monthIndex + offset + 1, 0).getDate(); add(new Date(year, monthIndex + offset, Math.min(anchorDay, lastDay), 12)) }
      } else {
        const interval = cycle === 'weekly' ? 7 : 14; const start = new Date(year, monthIndex, 1, 12); const end = new Date(year, monthIndex + 1, 2, 12); const cursor = parseDate(anchor)
        const distance = (Date.UTC(year, monthIndex, 1) - Date.UTC(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())) / 86400000
        cursor.setDate(cursor.getDate() + Math.floor(distance / interval) * interval)
        while (cursor < start) cursor.setDate(cursor.getDate() + interval)
        while (cursor <= end) { add(cursor); cursor.setDate(cursor.getDate() + interval) }
      }
    }
    return results.filter((item, index, rows) => rows.findIndex((row) => row.date === item.date) === index).sort((a, b) => a.date.localeCompare(b.date))
  }
  const paydaysFor = (key = state.selectedMonth) => { const entered = state.paydays.filter((item) => String(item.date).startsWith(key)); return [...entered, ...forecastPaydaysFor(key).filter((forecast) => !entered.some((item) => item.date === forecast.date))].sort((a, b) => a.date.localeCompare(b.date)) }
  const extrasFor = (key = state.selectedMonth) => state.moneyIn.filter((item) => String(item.date).startsWith(key))
  const incomeFor = (key = state.selectedMonth) => { const rows = [...paydaysFor(key), ...extrasFor(key)]; return rows.length ? rows.reduce((sum, item) => sum + num(item.amount), 0) : num(state.incomeByMonth?.[key]) }
  const goalDepositsFor = (key = state.selectedMonth) => BudgetFinance.round(state.goals.reduce((total, goal) => total + (goal.keepOut === false ? 0 : goal.contributions.filter(item => item.date.startsWith(key)).reduce((sum, item) => sum + BudgetFinance.cash(item, 'goal'), 0)), 0))
  const debtPaymentsFor = (key = state.selectedMonth) => BudgetFinance.round(state.debts.reduce((total, debt) => total + debt.history.filter(item => item.date.startsWith(key)).reduce((sum, item) => sum + BudgetFinance.cash(item, 'debt'), 0), 0))
  const billTotal = (key = state.selectedMonth) => billsFor(key).reduce((sum, item) => sum + num(item.amount), 0)
  const spentTotal = (key = state.selectedMonth) => expensesFor(key).reduce((sum, item) => sum + num(item.amount), 0)
  const remaining = (key = state.selectedMonth) => incomeFor(key) - billTotal(key) - spentTotal(key) - goalDepositsFor(key) - debtPaymentsFor(key)
  const divisor = (key = state.selectedMonth) => key === currentMonth ? Math.max(1, daysInMonth(key) - now.getDate() + 1) : daysInMonth(key)
  const goalTotal = (goal) => BudgetFinance.balance(goal, 'goal')

  const toast = (message, actionLabel = '', callback = null) => {
    $('#toastText').textContent = message
    const action = $('#toastAction')
    undoCallback = callback
    action.hidden = !callback
    action.textContent = actionLabel || 'Undo'
    $('#toast').classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { $('#toast').classList.remove('show'); undoCallback = null }, callback ? 5000 : 2400)
  }
  const downloadBlob = (blob, filename) => {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob); link.download = filename; document.body.append(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }
  const launchWasSeen = () => { try { return sessionStorage.getItem(LAUNCH_SEEN_KEY) === 'yes' } catch { return false } }
  const rememberLaunch = () => { try { sessionStorage.setItem(LAUNCH_SEEN_KEY, 'yes') } catch {} }
  const clearLaunchTimers = () => { launchTimers.forEach(clearTimeout); launchTimers = [] }
  const closeLaunch = (instant = false) => {
    clearLaunchTimers(); rememberLaunch(); document.body.classList.remove('launching')
    if (typeof location !== 'undefined' && location.hash === '#screen-opening') history.replaceState(null, '', '#screen-' + activeView)
    appShell.inert = false; appShell.removeAttribute('aria-hidden')
    launchScreen.inert = true
    if (launchScreen.contains(document.activeElement)) (launchReturnFocus?.isConnected ? launchReturnFocus : $('#menuButton')).focus({ preventScroll:true })
    if (instant) { launchScreen.hidden = true; launchScreen.classList.remove('playing', 'leaving'); return }
    launchScreen.classList.add('leaving')
    launchTimers.push(setTimeout(() => { launchScreen.hidden = true; launchScreen.classList.remove('playing', 'leaving') }, 520))
  }
  let welcomeForce = false
  const storeWelcomeName = (value) => {
    const name = String(value || '').trim()
    if (!name || name.length > 32) return 'Please enter a name or nickname (up to 32 characters).'
    const previous = state.profile.name
    state.profile.name = name
    try { save() } catch { state.profile.name = previous; return 'Your name could not be saved. Please check browser storage and try again.' }
    return ''
  }
  const playLaunch = (force = false, afterWelcome = false) => {
    clearLaunchTimers()
    const needsName = !String(state.profile.name || '').trim()
    welcomeForce = force
    $('#welcomeNameForm').hidden = !needsName
    ;['#launchTitle', '#launchGreeting', '#enterLaunch', '#launchStatus', '#skipLaunch'].forEach(id => $(id).hidden = needsName)
    launchScreen.setAttribute('aria-labelledby', needsName ? 'welcomeNameTitle' : 'launchTitle')
    if (!needsName && !afterWelcome && !force && launchWasSeen()) { closeLaunch(true); return }
    const reduced = state.theme.calmMode || matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!needsName && reduced && !force) { closeLaunch(true); return }
    const duration = 4200
    if (!launchScreen.contains(document.activeElement)) launchReturnFocus = document.activeElement !== document.body ? document.activeElement : null
    launchScreen.hidden = false; launchScreen.inert = false; launchScreen.classList.toggle('launch-calm', reduced); launchScreen.classList.remove('leaving', 'playing'); document.body.classList.add('launching'); appShell.inert = true; appShell.setAttribute('aria-hidden', 'true'); $('#launchStatus').textContent = force ? 'Take your time. Enter whenever you’re ready.' : 'Your planner is ready.'
    $('#launchDate').textContent = new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }); $('#launchDate').setAttribute('datetime', dateKey(new Date()))
    launchScreen.scrollTop = 0
    launchScreen.classList.remove('launch-paused'); $('#pauseLaunch').hidden = reduced; $('#pauseLaunch').textContent = 'Pause motion'; $('#pauseLaunch').setAttribute('aria-pressed', 'false')
    requestAnimationFrame(() => launchScreen.classList.add('playing'))
    if (needsName) { $('#welcomeNameError').textContent = ''; $('#welcomeName').focus({ preventScroll:true }); return }
    $('#launchGreeting').textContent = `Welcome, ${state.profile.name.trim()}. A little space for your plans and what comes next.`
    if (!force) launchTimers.push(setTimeout(() => closeLaunch(false), duration))
    $('#enterLaunch').focus({ preventScroll:true })
  }
  const questDone = (id) => id === 'spend'
    ? state.expenses.some(row => row.date === currentDate) || state.noSpendDays.includes(currentDate)
    : id === 'bill' ? billsFor(currentMonth).some(row => row.paid)
    : state.goals.some(goal => goal.contributions.some(row => row.date === currentDate && BudgetFinance.type(row,'goal') === 'deposit'))
  const questData = () => [
    { id:'spend', icon:'＋', title:'Daily check-in', detail:'Log a purchase or a no-spend day', done:'Checked in today', view:'today' },
    { id:'bill', icon:'✓', title:'Review your bills', detail:'Check what is due this month', done:'A bill is marked paid this month', view:'bills' },
    { id:'goal', icon:'↗', title:'Add to your savings', detail:'Set aside a little when you can', done:'A contribution is recorded today', view:'goals' }
  ]

  const rgb = (hex) => { const clean = String(hex).replace('#', ''); return /^[0-9a-f]{6}$/i.test(clean) ? `${parseInt(clean.slice(0, 2), 16)}, ${parseInt(clean.slice(2, 4), 16)}, ${parseInt(clean.slice(4, 6), 16)}` : '32, 60, 56' }
  const fontStack = (name) => ['Lora', 'Cormorant Garamond'].includes(name) ? `"${name}", Georgia, serif` : ['Kalam', 'Caveat', 'Patrick Hand', 'Dancing Script', 'Sacramento'].includes(name) ? `"${name}", cursive` : `"${name}", Arial, sans-serif`
  const applyTheme = () => {
    const theme = state.theme
    ;[appShell, document.documentElement].forEach((root) => {
      root.style.setProperty('--main', theme.main); root.style.setProperty('--main-rgb', rgb(theme.main)); root.style.setProperty('--accent', theme.accent); root.style.setProperty('--accent-rgb', rgb(theme.accent)); root.style.setProperty('--canvas', theme.canvas)
    })
    document.documentElement.style.setProperty('--body-font', fontStack(theme.bodyFont)); document.documentElement.style.setProperty('--heading-font', fontStack(theme.headingFont)); document.documentElement.style.setProperty('--hand-font', fontStack(theme.handwritingFont))
    appShell.classList.toggle('dark-mode', theme.nightMode); document.body.classList.toggle('dark-mode', theme.nightMode); appShell.classList.toggle('calm', theme.calmMode)
    appShell.classList.toggle('help-on', state.ui.helpMode); appShell.classList.toggle('focus-mode', state.ui.focusMode && activeView === 'today'); appShell.classList.toggle('simple-mode', state.profile.depth === 'simple')
    appShell.classList.remove('hand-scope-headings', 'hand-scope-full'); if (theme.handScope === 'headings') appShell.classList.add('hand-scope-headings'); if (theme.handScope === 'full') appShell.classList.add('hand-scope-full')
    $('meta[name="theme-color"]').setAttribute('content', theme.nightMode ? '#111816' : theme.main)
  }

  const renderMonthRail = () => {
    const { year, monthIndex } = parts()
    $('#railYear').textContent = year
    const data = new Set([...state.expenses, ...state.paydays, ...state.moneyIn].map((item) => String(item.date).slice(0, 7)))
    $('#monthTabs').innerHTML = SHORT_MONTHS.map((label, index) => {
      const key = `${year}-${String(index + 1).padStart(2, '0')}`
      return `<button class="month-tab${index === monthIndex ? ' active' : ''}${data.has(key) ? ' has-data' : ''}" style="--tab-color:${TAB_COLORS[index]}" data-month="${key}" type="button" aria-label="Open ${MONTHS[index]} ${year}"${index === monthIndex ? ' aria-current="true"' : ''}>${label}</button>`
    }).join('')
    requestAnimationFrame(() => { if (matchMedia('(max-width: 680px)').matches) { const active = $('.month-tab.active'); if (active) $('#monthTabs').scrollTo({ left: active.offsetLeft - ($('#monthTabs').clientWidth - active.offsetWidth) / 2, behavior: state.theme.calmMode ? 'auto' : 'smooth' }) } })
  }
  const renderSummary = () => {
    const income = incomeFor(); const bills = billTotal(); const spent = spentTotal(); const left = remaining(); const daily = left / divisor(); const list = billsFor(); const open = list.filter((item) => !item.paid).length
    setAnimatedMoney('#metricIncome', income); setAnimatedMoney('#metricBills', bills); setAnimatedMoney('#metricSpent', spent); setAnimatedMoney('#metricRemaining', left)
    $('#metricBillsNote').textContent = `${open} of ${list.length} bills still due`; $('#metricDaily').textContent = `${masked(daily)} gentle daily guide`; setAnimatedMoney('#dailyAllowance', daily, '/day')
    const todayLeft = remaining(currentMonth); const todayDays = divisor(currentMonth)
    setAnimatedMoney('#sidebarBalance', left); setAnimatedMoney('#todaySafe', todayLeft / todayDays); $('#todayFormula').textContent = `${masked(todayLeft)} planned balance ÷ ${todayDays} days left in ${MONTHS[now.getMonth()]}. Includes scheduled income.`; $('#sidebarMeter').style.width = `${clamp(income ? left / income * 100 : 0, 0, 100)}%`
    $('#sidebarNote').textContent = `${MONTHS[parts().monthIndex]} ${parts().year} · after plans and spending`
    appShell.classList.toggle('private', state.privateMode); $('#privacyButton').textContent = state.privateMode ? 'Show values' : 'Hide values'; $('#privacyButton').setAttribute('aria-pressed', String(state.privateMode))
  }
  const renderCheckins = () => {
    const quests=questData(),done=quests.filter(item=>questDone(item.id)).length
    $('#questProgress').textContent=`${done} / 3`;$('#todayQuestScore').textContent=`${done} / 3`
    const list = compact => quests.map(item=>`<button class="${compact?'mini-quest':'quest-item'}${questDone(item.id)?' complete':''}" type="button" data-quest-view="${item.view}"><i class="quest-icon">${questDone(item.id)?'✓':item.icon}</i><span><strong>${item.title}</strong><small>${questDone(item.id)?item.done:item.detail}</small></span><b>${questDone(item.id)?'DONE':'OPEN'}</b></button>`).join('')
    $('#dailyQuestList').innerHTML=list(false);$('#todayQuestList').innerHTML=list(true)
  }
  const renderBars = (selector, key = state.selectedMonth) => {
    const rows = CATEGORIES.map((category) => ({ category, amount: expensesFor(key).filter((item) => item.category === category).reduce((sum, item) => sum + num(item.amount), 0) })).filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount); const max = Math.max(1, ...rows.map((item) => item.amount))
    $(selector).innerHTML = rows.length ? rows.map((item) => `<div class="category-row"><div><span>${esc(item.category)}</span><strong class="money">${masked(item.amount)}</strong></div><i><b style="width:${item.amount / max * 100}%"></b></i></div>`).join('') : '<p class="empty-copy">Log spending to see a real category pattern.</p>'
  }
  // Visuals share the planner's cash-flow rules. Reservations are not transactions.
  const insightSelection = {}
  const sixMonthActivity = (key) => {
    const end=parseDate(key+'-01')
    return Array.from({length:6},(_,i)=>{
      const date=new Date(end);date.setMonth(end.getMonth()-5+i);const month=monthKey(date)
      return {month,income:BudgetFinance.round([...state.paydays,...state.moneyIn].filter(row=>row.date.startsWith(month)).reduce((sum,row)=>sum+num(row.amount),0)),spending:BudgetFinance.round(spentTotal(month))}
    })
  }
  const trendChart = key => {
    const rows=sixMonthActivity(key),max=Math.max(1,...rows.flatMap(row=>[row.income,row.spending]))
    return `<article class="paper-card trend-card"><div class="card-heading"><div><span class="eyebrow">A WIDER VIEW</span><h2>Income & spending</h2></div><span class="insight-period">Six months · select one to explore</span></div><div class="trend-key"><span><i></i>Income entries</span><span><i></i>Spending logs</span></div><div class="trend-columns">${rows.map(row=>`<button type="button" data-insight-open="month" data-insight-month="${row.month}" aria-label="Open ${esc(readableDate(row.month+'-01',{month:'long',year:'numeric'}))}: income entries ${masked(row.income)}, spending logs ${masked(row.spending)}"><span class="trend-bar-pair"><i style="height:${state.privateMode?0:row.income/max*100}%"></i><i style="height:${state.privateMode?0:row.spending/max*100}%"></i></span><strong>${esc(readableDate(row.month+'-01',{month:'short'}))}</strong><small>${row.month.slice(0,4)}</small></button>`).join('')}</div><details class="insight-records"><summary>Amounts & what is included</summary><p>Saved income entries and everyday spending only. An income entry is not bank confirmation. Forecasts, bills and savings/debt transfers are excluded from this comparison.</p><div class="insight-table"><table><thead><tr><th>Month</th><th>Income entries</th><th>Spending logs</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(readableDate(row.month+'-01',{month:'short',year:'numeric'}))}</td><td class="money">${masked(row.income)}</td><td class="money">${masked(row.spending)}</td></tr>`).join('')}</tbody></table></div></details></article>`
  }
  const insightSnapshot = (key) => {
    const round = BudgetFinance.round
    const savings = goalDepositsFor(key)
    const groups = [
      { id:'bills', label:'Bills', amount:round(billTotal(key)), color:'#d89077', view:'bills' },
      { id:'spending', label:'Spending', amount:round(spentTotal(key)), color:'var(--main)', view:'month' },
      { id:'debt', label:'Debt payments', amount:round(debtPaymentsFor(key)), color:'#c6a150', view:'debt' },
      { id:'savings', label:'Savings set aside', amount:Math.max(0,savings), color:'#70aa90', view:'goals' }
    ]
    const used = round(groups.reduce((sum,row) => sum+row.amount,0))
    const income = round(incomeFor(key)); const returned = Math.max(0,-savings)
    const left = round(income + returned - used)
    const days = Array.from({length:daysInMonth(key)},(_,i) => {
      const date = makeDate(key,i+1); const entries = expensesFor(key).filter(row => row.date === date)
      return {date, amount:round(entries.reduce((sum,row)=>sum+num(row.amount),0)), count:entries.length}
    })
    return { key, groups, used, income, returned, left, days, total:round(used+Math.max(0,left)) }
  }
  const insightRows = (key, group) => {
    if (group === 'bills') return billsFor(key).map(row=>({date:makeDate(key,row.due),label:row.name,detail:row.paid?'Paid bill':'Planned bill · unpaid',amount:row.amount}))
    if (group === 'spending') return expensesFor(key).map(row=>({date:row.date,label:row.note||row.category,detail:row.category,amount:row.amount}))
    const goal = group === 'savings'
    return (goal?state.goals:state.debts).flatMap(account => (goal?account.contributions:account.history).filter(row=>row.date.startsWith(key) && (!goal || account.keepOut !== false) && BudgetFinance.cash(row,goal?'goal':'debt')!==0).map(row=>({date:row.date,label:account.name,detail:row.note || (goal?'Savings transfer':'Debt payment'),amount:BudgetFinance.cash(row,goal?'goal':'debt')})))
  }
  const renderInsights = (selector,key) => {
    const host = $(selector); if (!host) return
    const data=insightSnapshot(key); const chosen=insightSelection[selector] || 'spending'
    const segments=[...data.groups,{id:'left',label:'Plan left',amount:Math.max(0,data.left),color:'var(--line)'}]
    let position=0
    const stops=segments.filter(row=>row.amount>0).map(row=>{const start=position;position+=row.amount/Math.max(1,data.total)*100;return `${row.color} ${start}% ${position}%`})
    const gradient=(!state.privateMode && data.total>0)?`conic-gradient(${stops.join(',')})`:'var(--line)'
    const rows=insightRows(key,chosen).sort((a,b)=>b.date.localeCompare(a.date))
    const max=Math.max(1,...data.days.map(row=>row.amount)); const spendingDays=data.days.filter(row=>row.count).length
    host.innerHTML=`<article class="paper-card flow-card"><div class="card-heading"><div><span class="eyebrow">YOUR MONEY, AT A GLANCE</span><h2>Your money, in perspective</h2></div><span class="insight-period">${esc(readableDate(key+'-01',{month:'long',year:'numeric'}))}</span></div>
      <div class="flow-layout"><div class="flow-ring" style="--flow:${gradient}" role="img" aria-label="Monthly plan distribution. Exact amounts are listed beside the chart."><div><small>${data.left<0?'OVER PLAN':'PLAN LEFT'}</small><strong class="money">${masked(Math.abs(data.left))}</strong><span>${data.total?'after plans & activity':'Add your first record'}</span></div></div>
      <div class="flow-legend"><p>Tap a category to see its records.</p>${data.groups.map(row=>`<button type="button" data-insight-group="${row.id}" data-insight-host="${selector}" aria-pressed="${chosen===row.id}"><i style="background:${row.color}" aria-hidden="true"></i><span>${row.label}</span><strong class="money">${masked(row.amount)}</strong><b aria-hidden="true">↗</b></button>`).join('')}</div></div>
      <div class="flow-totals"><div><small>Planned income</small><strong class="money">${masked(data.income)}</strong></div><div><small>Used / committed</small><strong class="money">${masked(data.used)}</strong></div><div><small>${data.left<0?'Over plan':'Plan left'}</small><strong class="money">${masked(Math.abs(data.left))}</strong></div></div>
      <details class="insight-method"><summary>What is included?</summary><p>All bills for this month (paid or unpaid), logged spending, debt payments and net savings set aside. Scheduled and forecast income may not have arrived. Savings returns offset deposits; excess returns add ${masked(data.returned)} to the plan. Borrowing, savings purchases and balance corrections are not counted twice. This is your plan, not a bank balance.</p></details>
      <details class="insight-records" ${insightSelection[selector]?'open':''}><summary>${data.groups.find(row=>row.id===chosen).label} · ${rows.length} records</summary><div>${rows.length?rows.map(row=>`<div class="insight-record"><span><strong>${esc(row.label)}</strong><small>${esc(readableDate(row.date))} · ${esc(row.detail)}</small></span><b class="money">${masked(row.amount)}</b></div>`).join(''):'<p class="empty-copy">No records here yet. Your chart grows as you add them.</p>'}</div><button type="button" class="ghost-button small-button" data-insight-open="${data.groups.find(row=>row.id===chosen).view}" data-insight-month="${key}">Open ${chosen==='spending'?'Planner':chosen==='savings'?'Goals':chosen==='debt'?'Debt':'Bills'} →</button></details></article>
      <article class="paper-card rhythm-card"><div class="card-heading"><div><span class="eyebrow">EVERY DAY TELLS A LITTLE STORY</span><h2>Your spending rhythm</h2></div><strong class="money">${masked(spentTotal(key))}</strong></div><p>${spendingDays?`${spendingDays} ${spendingDays===1?'day':'days'} with spending entries.`:'No spending logged yet.'} Select a day to open its journal.</p>
      <div class="rhythm-scroll" tabindex="0" aria-label="Daily spending chart. Scroll horizontally for all dates."><div class="rhythm-bars">${data.days.map(row=>`<button type="button" class="rhythm-day${row.date===currentDate?' is-today':''}" data-insight-day="${row.date}" aria-label="${esc(readableDate(row.date,{month:'long',day:'numeric',year:'numeric'}))}: ${masked(row.amount)}, ${row.count} ${row.count===1?'entry':'entries'}"><span class="rhythm-track"><i style="height:${state.privateMode?0:row.amount/max*100}%"></i></span><small>${Number(row.date.slice(-2))}</small></button>`).join('')}</div></div><div class="rhythm-caption"><span>${esc(readableDate(key+'-01',{month:'short'}))} 1</span><span>Daily logged spending · tap to explore</span><span>${daysInMonth(key)}</span></div>
      <details class="insight-records"><summary>View daily amounts as a table</summary><div class="insight-table"><table><thead><tr><th>Date</th><th>Entries</th><th>Spending</th></tr></thead><tbody>${data.days.map(row=>`<tr><td>${esc(readableDate(row.date))}</td><td>${row.count}</td><td class="money">${masked(row.amount)}</td></tr>`).join('')}</tbody></table></div></details></article>${selector==='#monthInsights'?trendChart(key):''}`
  }
  const renderActivity = (selector, items) => {
    $(selector).innerHTML = items.length ? [...items].sort((a, b) => `${b.date}${b.time || ''}`.localeCompare(`${a.date}${a.time || ''}`)).map((item) => `<article class="activity-row"><span class="activity-mark">${esc(item.category.charAt(0) || '•')}</span><div><strong>${esc(item.note || item.category)}</strong><small>${readableDate(item.date)}${item.time ? ` · ${esc(item.time)}` : ''} · ${esc(item.category)}</small></div><b class="money">${masked(item.amount)}</b><div class="row-actions"><button type="button" data-expense-edit="${item.id}">Edit</button><button type="button" data-expense-remove="${item.id}" aria-label="Remove">×</button></div></article>`).join('') : '<p class="empty-copy">Nothing logged here yet.</p>'
  }
  const renderFilteredRegister = () => {
    const query = $('#registerSearch').value.trim().toLowerCase(); const category = $('#registerCategory').value
    const rows = expensesFor().filter((item) => (!category || item.category === category) && (!query || `${item.note || ''} ${item.category} ${item.date} ${item.amount}`.toLowerCase().includes(query)))
    renderActivity('#monthRegister', rows)
    $('#registerCount').textContent = `${rows.length} of ${expensesFor().length} entries · ${masked(rows.reduce((sum, item) => sum + num(item.amount), 0))}`
    if (!rows.length && (query || category)) $('#monthRegister').innerHTML = '<p class="empty-copy">No matches. Try another word or clear the filters.</p>'
  }
  const renderFocusState = () => {
    const focused = state.ui.focusMode && activeView === 'today'
    appShell.classList.toggle('focus-mode', focused)
    $('#focusNotice').hidden = !focused
    $('#focusButton').setAttribute('aria-label', focused ? 'Turn off Focus mode' : 'Turn on Focus mode')
    $('#focusButton span').textContent = focused ? 'Focus ON' : 'Focus'
  }
  const setFocus = (enabled) => {
    state.ui.focusMode = enabled; save(); switchView('today'); renderAll()
    if (!enabled) $('#focusButton').focus()
  }
  const weeklySnapshot = () => {
    const start = new Date(now); start.setDate(start.getDate() - 6)
    const previousStart = new Date(start); previousStart.setDate(previousStart.getDate() - 7)
    const startKey = dateKey(start); const previousKey = dateKey(previousStart)
    const rows = state.expenses.filter((item) => item.date >= startKey && item.date <= currentDate)
    const previous = state.expenses.filter((item) => item.date >= previousKey && item.date < startKey)
    const totals = CATEGORIES.map((category) => ({ category, amount: rows.filter((item) => item.category === category).reduce((sum, item) => sum + num(item.amount), 0) })).sort((a, b) => b.amount - a.amount)
    const noSpend = state.noSpendDays.filter((day) => day >= startKey && day <= currentDate && !rows.some((row) => row.date === day))
    return { startKey, rows, total: rows.reduce((sum, item) => sum + num(item.amount), 0), previous: previous.reduce((sum, item) => sum + num(item.amount), 0), previousCount: previous.length, top: totals[0], checkIns: new Set([...rows.map((item) => item.date), ...noSpend]).size }
  }
  const renderWeeklyReview = () => {
    const week = weeklySnapshot()
    $('#weekRange').textContent = `${readableDate(week.startKey)} – ${readableDate(currentDate)}`
    setAnimatedMoney('#weekTotal', week.total); $('#weekCheckIns').textContent = `${week.checkIns} / 7 days`; $('#weekTopCategory').textContent = week.top.amount > 0 ? week.top.category : 'No spending logged'
    $('#weekComparison').textContent = week.previousCount ? `${masked(Math.abs(week.total - week.previous))} ${week.total > week.previous ? 'more' : week.total < week.previous ? 'less' : 'difference'} than the previous seven days of logged spending.` : 'Your next check-in builds the picture. Only saved entries are counted.'
  }
  const dayItems = (key) => {
    const day = Number(key.slice(-2)); const month = key.slice(0, 7)
    return [...billsFor(month).filter((item) => num(item.due) === day).map((item) => ({ type: 'bill', label: item.name, amount: item.amount, paid: item.paid })), ...state.expenses.filter((item) => item.date === key).map((item) => ({ type: 'spend', label: item.note || item.category, amount: item.amount })), ...paydaysFor(month).filter((item) => item.date === key).map((item) => ({ type: 'payday', label: item.name, amount: item.amount, forecast: item.forecast })), ...state.moneyIn.filter((item) => item.date === key).map((item) => ({ type: 'payday', label: item.name, amount: item.amount }))]
  }
  const renderAgenda = () => {
    const rows = []
    for (let day = 1; day <= daysInMonth(); day += 1) { const date = makeDate(state.selectedMonth, day); dayItems(date).forEach((item) => rows.push({ ...item, date })) }
    $('#monthAgenda').hidden = !state.ui.agendaOpen; $('#agendaToggle').setAttribute('aria-expanded', String(state.ui.agendaOpen)); $('#agendaToggle b').textContent = state.ui.agendaOpen ? 'Hide list ↑' : `Show ${rows.length || ''} item${rows.length === 1 ? '' : 's'} ↓`
    $('#monthAgenda').innerHTML = rows.length ? rows.map((item) => `<button class="agenda-row" type="button" data-date="${item.date}"><time><b>${Number(item.date.slice(-2))}</b><small>${readableDate(item.date, { weekday: 'short' }).toUpperCase()}</small></time><i class="legend-dot ${item.type}"></i><span><strong>${esc(item.label)}</strong><small>${item.forecast ? 'forecast · ' : ''}${item.type === 'bill' && item.paid ? 'paid bill' : item.type}</small></span><b class="money">${masked(item.amount)}</b></button>`).join('') : '<p class="empty-copy">Nothing on the books for this month yet.</p>'
  }
  const renderSelectedDay = () => {
    const key = state.selectedDate; const items = dayItems(key)
    $('#selectedDayNumber').textContent = Number(key.slice(-2)); $('#selectedDayName').textContent = readableDate(key, { weekday: 'long', month: 'long', day: 'numeric' }); $('#selectedDayLabel').textContent = items.length ? `${items.length} money item${items.length === 1 ? '' : 's'} on this day.` : 'A clear day. Add spending whenever you need.'
    $('#dayEvents').innerHTML = items.length ? items.map((item) => `<div class="day-event"><i class="legend-dot ${item.type}"></i><span><strong>${esc(item.label)}</strong><small>${item.type === 'bill' && item.paid ? 'paid' : item.type}</small></span><b class="money">${masked(item.amount)}</b></div>`).join('') : '<p class="empty-copy">Nothing saved on this date.</p>'
  }
  const renderCalendar = () => {
    const { year, monthIndex } = parts(); const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7; const cells = Array.from({ length: offset }, () => '<span class="calendar-blank" aria-hidden="true"></span>')
    for (let day = 1; day <= daysInMonth(); day += 1) { const key = makeDate(state.selectedMonth, day); const items = dayItems(key); const dots = [...new Set(items.map((item) => item.type))].map((type) => `<i class="day-dot ${type}"></i>`).join(''); cells.push(`<button class="calendar-day${key === state.selectedDate ? ' selected' : ''}${key === currentDate ? ' today' : ''}" data-date="${key}" type="button" role="gridcell" aria-label="${readableDate(key, { month: 'long', day: 'numeric', year: 'numeric' })}, ${items.length} money items"><span>${day}</span><small>${dots}</small></button>`) }
    $('#calendarGrid').innerHTML = cells.join(''); if (!state.selectedDate.startsWith(state.selectedMonth)) state.selectedDate = `${state.selectedMonth}-01`; renderSelectedDay(); renderAgenda()
  }

  const renderMonth = () => {
    const { year, monthIndex } = parts(); const open = billsFor().filter((item) => !item.paid).sort((a, b) => a.due - b.due)
    $('#monthTitle').textContent = `${MONTHS[monthIndex]} ${year}`; $('#monthSubtitle').textContent = state.notes[state.selectedMonth] || state.monthNotes[state.selectedMonth]?.length ? 'Your notes and numbers are waiting exactly where you left them.' : 'A clear view of what is coming and what is still yours.'; $('#monthNote').value = editingMonthNote?.month === state.selectedMonth ? editingMonthNote.text : state.notes[state.selectedMonth] || ''; setAnimatedMoney('#glanceSpent', spentTotal())
    renderFilteredRegister(); renderBars('#monthCategoryBars'); renderCalendar()
    renderMonthNotes()
    renderInsights('#monthInsights', state.selectedMonth)
    if (open.length) { $('#nextStepTitle').textContent = `${open[0].name} is the next open bill`; $('#nextStepText').textContent = `${money(open[0].amount)} · due day ${open[0].due}. One tap marks it paid.` } else if (!state.expenses.some((item) => item.date === currentDate)) { $('#nextStepTitle').textContent = 'Capture anything you spent today'; $('#nextStepText').textContent = 'A tiny update keeps the daily guide useful.' } else { $('#nextStepTitle').textContent = 'Your month is up to date'; $('#nextStepText').textContent = 'You can stop here. Return when something changes.' }
  }
  const renderMonthNotes = () => {
    const list = state.monthNotes[state.selectedMonth] || []
    if (editingMonthNote?.month !== state.selectedMonth) editingMonthNote = null
    $('#monthNotesHeading').textContent = `Notes for ${MONTHS[parts().monthIndex]} ${parts().year}`
    $('#monthNoteCount').textContent = `${list.length} ${list.length === 1 ? 'note' : 'notes'} kept`
    $('#keepMonthNote').textContent = editingMonthNote ? 'Save note changes' : 'Keep this note'
    $('#cancelMonthNoteEdit').hidden = !editingMonthNote
    $('#noteSaved').textContent = editingMonthNote ? 'Editing · save changes below' : state.notes[state.selectedMonth] ? 'Draft saved' : 'Ready for your next note'
    $('#keptMonthNotes').innerHTML = list.length ? [...list].reverse().map(note => `<article class="kept-note"><time>${esc(readableDate(note.date, { day:'numeric', month:'short', year:'numeric' }))}</time><p>${esc(note.text)}</p><div><button type="button" data-month-note-edit="${note.id}">Edit</button><button type="button" data-month-note-remove="${note.id}">Delete</button></div></article>`).join('') : '<p class="empty-copy">Keep a thought, a reminder, or a reason behind a purchase. Each note stays with this month.</p>'
  }
  const shiftDay = (key, delta) => { const date = parseDate(key); date.setDate(date.getDate() + delta); return dateKey(date) }
  const upcomingFor = (start = currentDate) => {
    const end = shiftDay(start, 41); const keys = []; const cursor = parseDate(start.slice(0, 7) + '-01')
    while (monthKey(cursor) <= end.slice(0, 7)) { keys.push(monthKey(cursor)); cursor.setMonth(cursor.getMonth() + 1) }
    return keys.flatMap(key => [...billsFor(key).filter(item => !item.paid).map(item => ({ date: makeDate(key, Math.min(item.due, daysInMonth(key))), label: item.name, amount: item.amount, kind: 'Bill', view: 'bills' })), ...paydaysFor(key).map(item => ({ ...item, label: item.name, kind: item.forecast ? 'Payday forecast' : 'Scheduled paycheck', view: 'income' })), ...extrasFor(key).map(item => ({ ...item, label: item.name, kind: 'Other income', view: 'income' }))]).filter(item => item.date >= start && item.date <= end).sort((a, b) => a.date.localeCompare(b.date))
  }
  const dayJournal = (date) => {
    const entries = state.expenses.filter(item => item.date === date)
    return { entries, total: BudgetFinance.round(entries.reduce((sum, item) => sum + num(item.amount), 0)), noSpend: entries.length === 0 && state.noSpendDays.includes(date), intention: state.dailyIntentions[date]?.text || '' }
  }
  const renderDayJournal = () => {
    const journal = dayJournal(journalDate)
    $('#journalDate').value = journalDate
    $('#todayRegisterTitle').textContent = journalDate === currentDate ? 'Today’s register' : readableDate(journalDate, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
    $('#journalSummary').textContent = `${masked(journal.total)} logged · ${journal.entries.length} ${journal.entries.length === 1 ? 'entry' : 'entries'}${journal.noSpend ? ' · No-spend check-in' : ''}. Your daily guide above always stays on today.`
    renderActivity('#todayRegister', journal.entries)
    $('#journalIntention').hidden = !journal.intention; $('#journalIntention').textContent = journal.intention ? 'Money intention: ' + journal.intention : ''
    $$('[data-journal-day]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.journalDay === journalDate)) })
  }
  const renderToday = () => {
    const hour = now.getHours(); const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'; const todayRows = state.expenses.filter((item) => item.date === currentDate); const open = billsFor(currentMonth).filter((item) => !item.paid).sort((a, b) => a.due - b.due)[0]
    const checkedIn = todayRows.length > 0 || state.noSpendDays.includes(currentDate)
    $('#todayDateLabel').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase(); $('#todayGreeting').textContent = state.profile.name ? `${greeting}, ${state.profile.name}` : greeting; $('#rightNowTask').textContent = !checkedIn ? 'Log spending or check in for today' : open ? `Check ${open.name}` : 'You are caught up for today'; $('#rightNowButton').textContent = !checkedIn ? 'Do it now →' : open ? 'Review it →' : 'Add another →'
    $('#todayDateCard').setAttribute('datetime', currentDate); $('#todayBadgeMonth').textContent = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(); $('#todayBadgeDay').textContent = now.getDate(); $('#todayBadgeYear').textContent = now.getFullYear()
    $('#todayWelcomeCopy').textContent = checkedIn ? 'Your check-in is saved. A little attention goes a long way.' : 'Welcome back. A clear date, a small check-in, a little more room to breathe.'
    $('#todayPlanUntil').textContent = readableDate(makeDate(currentMonth, daysInMonth(currentMonth))); $('#todayPlanRemaining').textContent = masked(remaining(currentMonth))
    $('#todaySpentTotal').textContent = masked(dayJournal(currentDate).total); $('#todaySpentCount').textContent = `${todayRows.length} ${todayRows.length === 1 ? 'entry' : 'entries'}${state.noSpendDays.includes(currentDate) && !todayRows.length ? ' · No-spend day' : ''}`
    $$('[data-common-amount]').forEach(span => { span.textContent = masked(span.dataset.commonAmount) })
    $('#todayWeekStrip').innerHTML = Array.from({ length: 7 }, (_, index) => { const date = shiftDay(currentDate, index - 6); const data = dayJournal(date); return `<button type="button" data-journal-day="${date}" aria-label="View ${date} daily records" aria-pressed="${date === journalDate}"><small>${readableDate(date, { weekday: 'short' })}</small><strong>${parseDate(date).getDate()}</strong><span>${date === currentDate ? 'Today' : data.noSpend ? 'No spend' : data.entries.length ? data.entries.length + (data.entries.length === 1 ? ' entry' : ' entries') : '—'}</span></button>` }).join('')
    $('#noSpendButton').hidden = todayRows.length > 0; $('#noSpendButton').textContent = state.noSpendDays.includes(currentDate) ? '✓ No-spend day recorded · undo' : 'No spending today'; $('#noSpendButton').setAttribute('aria-pressed', String(state.noSpendDays.includes(currentDate)))
    renderDayJournal()
    renderInsights('#todayInsights', currentMonth)
    $('#brainDumpList').innerHTML = state.brainDump.length ? state.brainDump.map((item) => `<div class="brain-item"><span>${esc(item.text)}</span><button type="button" data-brain-remove="${item.id}" aria-label="Remove thought">×</button></div>`).join('') : '<p class="empty-copy">Your head can stay quiet here.</p>'
    const upcoming = upcomingFor(); const timeline = list => list.map(item => `<button type="button" class="today-upcoming-row" data-upcoming-date="${item.date}" data-upcoming-view="${item.view}"><time>${readableDate(item.date, { month: 'short', day: 'numeric' })}</time><span><strong>${esc(item.label)}</strong><small>${item.kind}</small></span><b class="money">${masked(item.amount)}</b></button>`).join('')
    $('#todayUpcomingRange').textContent = `${readableDate(currentDate)} – ${readableDate(shiftDay(currentDate, 41), { month: 'short', day: 'numeric', year: 'numeric' })} · ${upcoming.length} scheduled items`
    $('#todayTimeline').innerHTML = upcoming.length ? timeline(upcoming.slice(0, 6)) + (upcoming.length > 6 ? `<details><summary>Show ${upcoming.length - 6} more dates</summary>${timeline(upcoming.slice(6))}</details>` : '') : '<p class="empty-copy">Nothing scheduled in the next six weeks.</p>'
    $('#todayIntention').value = state.dailyIntentions[currentDate]?.text || ''; $('#todayIntentionDate').textContent = `Saved for ${currentDate} · earlier notes stay in your daily records`; $('#legacyIntention').hidden = !state.intention; $('#legacyIntentionText').textContent = state.intention || ''
    setAnimatedMoney('#todayMonthSpent', spentTotal(currentMonth)); renderBars('#todayCategoryBars', currentMonth); $('#monthTimeBar').style.width = `${now.getDate() / daysInMonth(currentMonth) * 100}%`; $('#runwayCopy').textContent = `${now.getDate()} of ${daysInMonth(currentMonth)} days used · ${Math.max(0, daysInMonth(currentMonth) - now.getDate())} days remain after today.`; renderPaydayRun(); renderWeeklyReview(); renderFocusState()
  }
  const renderBills = () => {
    const list = [...billsFor()].sort((a, b) => num(a.due) - num(b.due)); const paid = list.filter((item) => item.paid).length
    setAnimatedMoney('#billsTotalLabel', list.reduce((sum, item) => sum + num(item.amount), 0)); $('#billsPaidCount').textContent = paid; $('#billsOpenCount').textContent = list.length - paid; $('#billProgressBar').style.width = `${list.length ? paid / list.length * 100 : 0}%`
    $('#billList').innerHTML = list.length ? list.map((bill) => `<article class="bill-row${bill.paid ? ' paid' : ''}"><button class="bill-check" data-bill-toggle="${bill.id}" type="button" aria-label="Mark ${esc(bill.name)} ${bill.paid ? 'open' : 'paid'}">${bill.paid ? '✓' : ''}</button><div><strong>${esc(bill.name)}</strong><small>Day ${bill.due} · ${bill.frequency === 'once' ? 'one time' : 'monthly'}${bill.autopay ? ' · autopay' : ''}</small></div><b class="money">${masked(bill.amount)}</b><div class="row-actions"><button type="button" data-bill-edit="${bill.id}">Edit</button><button type="button" data-bill-remove="${bill.id}" aria-label="Remove">×</button></div></article>`).join('') : '<p class="empty-copy">No bills yet. Add one when you are ready.</p>'
  }
  const renderIncome = () => {
    const planned = paydaysFor(); const extras = extrasFor(); const rows = [...planned.map((item) => ({ ...item, kind: 'payday' })), ...extras.map((item) => ({ ...item, kind: 'extra' }))].sort((a, b) => a.date.localeCompare(b.date))
    setAnimatedMoney('#incomePlanned', planned.reduce((sum, item) => sum + num(item.amount), 0)); setAnimatedMoney('#incomeExtra', extras.reduce((sum, item) => sum + num(item.amount), 0)); setAnimatedMoney('#incomeCombined', incomeFor())
    $('#incomeList').innerHTML = rows.length ? rows.map((item) => `<article class="record-row"><span class="record-icon">↗</span><div><strong>${esc(item.name)}</strong><small>${readableDate(item.date)} · ${item.forecast ? 'forecast from Settings' : item.kind === 'payday' ? 'scheduled payday' : 'one-time income'}</small></div><b class="money">${masked(item.amount)}</b>${item.forecast ? '<span class="forecast-pill">FORECAST</span>' : `<div class="row-actions"><button type="button" data-income-edit="${item.kind}:${item.id}">Edit</button><button type="button" data-income-remove="${item.kind}:${item.id}">×</button></div>`}</article>`).join('') : '<p class="empty-copy">No income entered for this month.</p>'
  }
  const renderGoals = () => {
    $('#goalGrid').innerHTML = state.goals.length ? state.goals.map((goal) => {
      const saved = goalTotal(goal); const percent = clamp(saved / Math.max(1, num(goal.target)) * 100, 0, 100); const left = Math.max(0, num(goal.target) - saved); const months = num(goal.monthly) > 0 ? Math.ceil(left / num(goal.monthly)) : null
      return `<article class="goal-card paper-card"><div class="goal-ring" style="--progress:${percent * 3.6}deg"><span>${Math.round(percent)}%</span></div><div class="goal-copy"><span class="eyebrow">SAVING GOAL</span><h2>${esc(goal.name)}</h2>${financeUI.balanceChart(goal, 'goal')}${financeUI.accountSummary(goal, 'goal')}<small>${left <= 0 ? 'Goal reached' : months ? `About ${months} month${months === 1 ? '' : 's'} at ${money(goal.monthly)}/month` : `${money(left)} left · no monthly plan yet`}</small><label class="check-row compact-check"><input type="checkbox" data-goal-keepout="${goal.id}"${goal.keepOut !== false ? ' checked' : ''}><span>Keep deposits out of safe-to-use</span></label>${financeUI.buttons(goal, 'goal')}${financeUI.history(goal, 'goal')}<div class="row-actions"><button type="button" data-goal-remove="${goal.id}">Remove goal</button></div></div></article>`
    }).join('') : '<article class="paper-card empty-state"><strong>No goals yet</strong><p>Create one below. Starting small still counts.</p></article>'
  }
  const renderDebts = () => {
    const starting = state.debts.reduce((sum, item) => sum + num(item.startingBalance), 0); const left = state.debts.reduce((sum, item) => sum + num(item.balance), 0); const paid = state.debts.reduce((sum, item) => sum + (item.history || []).reduce((total, payment) => total + (BudgetFinance.type(payment, 'debt') === 'payment' ? num(payment.amount) : 0), 0), 0)
    $('#debtStarting').textContent = masked(starting); $('#debtPaid').textContent = masked(paid); $('#debtRemaining').textContent = masked(left); $('#debtCountLabel').textContent = state.debts.length ? `${state.debts.length} balance${state.debts.length === 1 ? '' : 's'} tracked locally` : 'nothing tracked yet'
    $('#debtGrid').innerHTML = state.debts.length ? state.debts.map((debt) => { const progress = clamp((num(debt.startingBalance) - num(debt.balance)) / Math.max(1, num(debt.startingBalance)) * 100, 0, 100); return `<article class="paper-card debt-card"><div class="card-heading"><div><span class="eyebrow">${num(debt.apr).toFixed(2)}% APR</span><h2>${esc(debt.name)}</h2></div><strong class="money">${masked(debt.balance)}</strong></div>${financeUI.balanceChart(debt, 'debt')}${financeUI.accountSummary(debt, 'debt')}<div class="debt-track"><i style="width:${progress}%"></i></div><p>${Math.round(progress)}% paid down · usual payment ${money(debt.payment)}</p>${financeUI.buttons(debt, 'debt')}${financeUI.history(debt, 'debt')}<div class="row-actions"><button type="button" data-debt-remove="${debt.id}">Remove account</button></div></article>` }).join('') : '<article class="paper-card empty-state"><strong>No debt tracked</strong><p>If this screen is not useful, Simple mode hides it.</p></article>'
  }
  const renderEnvelopes = () => {
    const spentBy = Object.fromEntries(CATEGORIES.map((category) => [category, expensesFor().filter((item) => item.category === category).reduce((sum, item) => sum + num(item.amount), 0)])); const cap = state.envelopes.reduce((sum, item) => sum + num(item.cap), 0); const assigned = state.envelopes.reduce((sum, item) => sum + (spentBy[item.category] || 0), 0)
    $('#envelopeLeft').textContent = masked(cap - assigned); $('#envelopeSummaryCopy').textContent = state.envelopes.length ? `${money(assigned)} used across ${state.envelopes.length} caps` : 'No caps yet'; $('#envelopeOverallBar').style.width = `${clamp(cap ? assigned / cap * 100 : 0, 0, 100)}%`
    $('#envelopeGrid').innerHTML = state.envelopes.length ? state.envelopes.map((item) => { const spent = spentBy[item.category] || 0; const left = num(item.cap) - spent; return `<article class="paper-card envelope-card${left < 0 ? ' over' : ''}"><div class="card-heading"><div><span class="eyebrow">${esc(item.category)}</span><h2>${esc(item.name)}</h2></div><strong class="money">${masked(left)}</strong></div><small>${left < 0 ? 'over the cap' : 'left this month'} · ${money(spent)} used</small><div class="envelope-track"><i style="width:${clamp(spent / Math.max(1, num(item.cap)) * 100, 0, 100)}%"></i></div><div class="row-actions"><button type="button" data-envelope-edit="${item.id}">Edit</button><button type="button" data-envelope-remove="${item.id}">Remove</button></div></article>` }).join('') : '<article class="paper-card empty-state"><strong>No envelopes yet</strong><p>Caps are optional. They never lock your money.</p></article>'
    const assignedCategories = new Set(state.envelopes.map((item) => item.category)); const unassigned = CATEGORIES.filter((category) => !assignedCategories.has(category) && spentBy[category] > 0); $('#unassignedSpent').textContent = masked(unassigned.reduce((sum, category) => sum + spentBy[category], 0)); $('#unassignedCategories').innerHTML = unassigned.length ? unassigned.map((category) => `<span>${esc(category)} · ${masked(spentBy[category])}</span>`).join('') : '<span>Everything logged is assigned—or there is nothing to assign.</span>'
  }
  const milestoneData = () => [
    { id: 'first-spend', icon: '＋', title: 'First capture', text: 'Log the first real purchase.', met: state.expenses.length >= 1 }, { id: 'five-spends', icon: '5', title: 'Visible rhythm', text: 'Log five purchases.', met: state.expenses.length >= 5 },
    { id: 'first-bill', icon: '✓', title: 'Bill clearer', text: 'Mark a bill paid.', met: state.bills.some((item) => Object.values(item.paidMonths || {}).some(Boolean)) }, { id: 'all-bills', icon: '★', title: 'Month cleared', text: 'Mark every tracked bill paid.', met: billsFor().length > 0 && billsFor().every((item) => item.paid) },
    { id: 'first-goal', icon: '◎', title: 'Goal named', text: 'Create a saving goal.', met: state.goals.length >= 1 }, { id: 'goal-half', icon: '50', title: 'Halfway glow', text: 'Reach 50% on a goal.', met: state.goals.some((goal) => goalTotal(goal) >= num(goal.target) * .5) },
    { id: 'debt-payment', icon: '↘', title: 'Balance mover', text: 'Record a debt payment.', met: state.debts.some((item) => (item.history || []).some(row => BudgetFinance.type(row, 'debt') === 'payment')) }, { id: 'backup', icon: '⇩', title: 'Future-you backup', text: 'Download a portable backup.', met: Boolean(state.milestones.reached.backup) }
  ]
  const renderMilestones = () => {
    const definitions = milestoneData(); let changed = false; definitions.forEach((item) => { if (item.met && !state.milestones.reached[item.id]) { state.milestones.reached[item.id] = currentDate; changed = true } }); if (changed) save()
    const reached = definitions.filter((item) => state.milestones.reached[item.id]).length; const percent = Math.round(reached / definitions.length * 100); $('#milestoneScore').textContent = `${reached} of ${definitions.length}`; $('#milestoneCopy').textContent = reached ? 'The actions are small; the evidence stays.' : 'Start with one real action.'; $('#milestoneRing').style.setProperty('--progress', `${percent * 3.6}deg`); $('#milestoneRing').innerHTML = `<span>${percent}%</span>`
    const visible = definitions.filter((item) => state.ui.milestoneFilter === 'all' || (state.ui.milestoneFilter === 'reached' ? state.milestones.reached[item.id] : !state.milestones.reached[item.id])); $('#milestoneGrid').innerHTML = visible.map((item) => { const hit = state.milestones.reached[item.id]; return `<article class="paper-card milestone-card${hit ? ' reached' : ''}"><span>${hit ? '✓' : item.icon}</span><div><small>${hit ? `Reached ${readableDate(hit)}` : 'Still ahead'}</small><h2>${item.title}</h2><p>${item.text}</p></div></article>` }).join('') || '<p class="empty-copy">No milestones match this filter.</p>'; $$('[data-milestone-filter]').forEach((button) => button.classList.toggle('active', button.dataset.milestoneFilter === state.ui.milestoneFilter))
  }
  const renderTheme = () => {
    const presets = [{ name: 'Tidepool', main: '#397382', accent: '#ef8c68', canvas: '#f8f2e9' }, { name: 'Orchard', main: '#4f7658', accent: '#d98961', canvas: '#f6f0df' }, { name: 'Berry Ink', main: '#6b4d72', accent: '#d87980', canvas: '#f7eff1' }, { name: 'Midnight', main: '#34516b', accent: '#e8a75d', canvas: '#edf2f3' }]
    $('#presetGrid').innerHTML = presets.map((item) => `<button type="button" data-preset='${JSON.stringify(item)}'><i style="--one:${item.main};--two:${item.accent};--three:${item.canvas}"></i><span>${item.name}</span></button>`).join('')
    ;[['mainColor', 'main'], ['accentColor', 'accent'], ['backgroundColor', 'canvas']].forEach(([id, key]) => { $(`#${id}`).value = state.theme[key]; $(`#${id}Output`).textContent = state.theme[key].toUpperCase() }); $('#bodyFont').value = state.theme.bodyFont; $('#headingFont').value = state.theme.headingFont; $('#handwritingFont').value = state.theme.handwritingFont; $(`input[name="handScope"][value="${state.theme.handScope}"]`).checked = true; $('#nightMode').checked = state.theme.nightMode; $('#calmMode').checked = state.theme.calmMode
  }
  const renderPrint = () => {
    const key = state.ui.printMonth || state.selectedMonth; const { year, monthIndex } = parts(key); const sections = state.ui.printSections; const expenses = expensesFor(key); const html = [`<header><div><img src="assets/aurely-logo.svg?v=29" alt=""><span><b>AurelyStudio</b><small>Monthly Budget Planner</small></span></div><em>${MONTHS[monthIndex]} ${year}</em></header>`]
    if (sections.summary) html.push(`<section><h3>Monthly snapshot</h3><div class="print-metrics"><span>Money in <b>${money(incomeFor(key))}</b></span><span>Bills <b>${money(billTotal(key))}</b></span><span>Spending <b>${money(spentTotal(key))}</b></span><span>Still yours <b>${money(remaining(key))}</b></span></div></section>`)
    if (sections.calendar) html.push(`<section><h3>Calendar</h3><div class="mini-calendar">${Array.from({ length: daysInMonth(key) }, (_, index) => `<span><b>${index + 1}</b><small>${dayItems(makeDate(key, index + 1)).length ? '•' : ''}</small></span>`).join('')}</div></section>`)
    if (sections.spending) html.push(`<section><h3>Spending</h3>${expenses.length ? expenses.map((item) => `<p><span>${readableDate(item.date)} · ${esc(item.note || item.category)}</span><b>${money(item.amount)}</b></p>`).join('') : '<p>Nothing logged.</p>'}</section>`)
    if (sections.goals) html.push(`<section><h3>Goals · current, all recorded entries</h3>${state.goals.map((goal) => `<p><span>${esc(goal.name)}</span><b>${money(goalTotal(goal))} / ${money(goal.target)}</b></p>`).join('') || '<p>No goals saved.</p>'}</section>`)
    if (sections.debt) html.push(`<section><h3>Debt · current, all recorded entries</h3>${state.debts.map((item) => `<p><span>${esc(item.name)}</span><b>${money(item.balance)}</b></p>`).join('') || '<p>No debt saved.</p>'}</section>`)
    if (sections.notes) html.push(`<section><h3>Notes for ${MONTHS[monthIndex]} ${year}</h3>${(state.monthNotes[key] || []).map(note => `<article class="printed-note"><small>${esc(note.date)}</small><p>${esc(note.text)}</p></article>`).join('')}${state.notes[key] ? `<article class="printed-note"><small>Current draft</small><p>${esc(state.notes[key])}</p></article>` : ''}${!(state.monthNotes[key] || []).length && !state.notes[key] ? '<p>No notes saved for this month.</p>' : ''}</section>`)
    html.push(BudgetReports.render(state, { month: key, allHistory: state.ui.printAllHistory, paycheckId: state.ui.printPaycheck, paychecks: sections.paychecks, history: sections.history }, money))
    html.push(`<footer class="report-footer">Created ${esc(new Date().toLocaleString('en-US'))} · Local planner records · AurelyStudio</footer>`)
    $('#printPageSize').textContent = `@page { size: ${state.ui.paperSize === 'Letter' ? 'Letter' : 'A4'}; margin: 12mm; }`
    $('#printPreview').classList.toggle('ink-saver', state.ui.inkSaver); $('#printPreview').dataset.paper = state.ui.paperSize; $('#printPreview').innerHTML = html.join('')
  }
  const nextPayday = () => {
    const rows = []
    for (let offset = 0; offset < 4; offset += 1) { const date = new Date(now.getFullYear(), now.getMonth() + offset, 1, 12); rows.push(...paydaysFor(monthKey(date))) }
    return rows.filter((item) => item.date >= currentDate).sort((a, b) => a.date.localeCompare(b.date))[0] || null
  }
  const payPeriodSnapshot = () => {
    const next = nextPayday(); const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 12); const target = next ? parseDate(next.date) : monthEnd; const days = Math.max(1, Math.round((target - parseDate(currentDate)) / 86400000)); const left = remaining(currentMonth); const cycleDays = state.profile.payCycle === 'weekly' ? 7 : state.profile.payCycle === 'monthly' ? 30 : state.profile.payCycle === 'twice-monthly' ? 15 : 14
    return { next, days, left, daily: left / days, progress: clamp((cycleDays - days) / cycleDays * 100, 0, 100) }
  }
  const renderPaydayRun = () => {
    const period = payPeriodSnapshot(); $('#paydayRunTitle').textContent = period.next ? `Next: ${readableDate(period.next.date, { weekday: 'short', month: 'short', day: 'numeric' })}` : 'No payday set · using month end'; $('#paydayDaysLeft').textContent = `${period.days} day${period.days === 1 ? '' : 's'}`; $('#paydayRunBar').style.width = `${period.progress}%`; setAnimatedMoney('#paydayStillYours', period.left); setAnimatedMoney('#paydayPerDay', period.daily, '/day'); setAnimatedMoney('#paydayLogged', spentTotal(currentMonth)); $('#paydayRunCopy').textContent = period.next ? `${period.next.forecast ? 'Forecast from your Settings rhythm' : 'Saved payday'} · nothing is marked as received automatically.` : 'Add a payday in Money in or set your usual rhythm in Settings.'
  }
  const renderPaydaySettings = () => {
    $('#usualPaycheck').value = num(state.profile.usualPaycheck) || ''; $('#payCycle').value = state.profile.payCycle || 'biweekly'; $('#payAnchor').value = state.profile.payAnchor || ''; $('#weekendEarly').checked = Boolean(state.profile.weekendEarly)
    const forecast = []
    for (let offset = 0; offset < 3; offset += 1) { const date = new Date(now.getFullYear(), now.getMonth() + offset, 1, 12); forecast.push(...forecastPaydaysFor(monthKey(date))) }
    const upcoming = forecast.filter((item) => item.date >= currentDate).slice(0, 4)
    $('#paydayPreview').innerHTML = upcoming.length ? `<span class="eyebrow">NEXT FORECASTS</span><div>${upcoming.map((item) => `<span><time>${readableDate(item.date, { month: 'short', day: 'numeric' })}</time><b class="money">${masked(item.amount)}</b></span>`).join('')}</div><small>Forecasts guide the plan. Record the real arrival in Money in when it lands.</small>` : '<p>Add your usual paycheck and one real paid date to preview upcoming paydays.</p>'
    const period = payPeriodSnapshot(); $('#periodDays').textContent = `${period.days} day${period.days === 1 ? '' : 's'}`; setAnimatedMoney('#periodSafe', period.left); setAnimatedMoney('#periodDaily', period.daily, '/day'); setAnimatedMoney('#periodChecking', state.profile.checking); setAnimatedMoney('#periodBills', billsFor(currentMonth).filter((item) => !item.paid).reduce((sum, item) => sum + num(item.amount), 0)); $('#periodCopy').textContent = period.next ? `Until ${readableDate(period.next.date, { weekday: 'long', month: 'long', day: 'numeric' })}. This is a planning view, not a bank balance.` : 'No upcoming payday is saved, so the fallback target is month end.'
  }
  const GUIDE_CONTENT = {
    start: { title: 'Start here', intro: 'Six things, in this order. Each takes about a minute.', cards: [['Type your checking balance', 'Open Settings → You & money. Copy the current number from your bank; this app never connects to it.'], ['Set your payday rhythm', 'Add a usual paycheck, choose the rhythm, and give one real paid date.'], ['Add your bills', 'List the payments that happen on their own so the planner does not mistake promised money for free money.'], ['Look at today’s safe number', 'Today turns the month into one useful number and one next action.'], ['Log one spend', 'Use Log spending or ⌘/Ctrl + K. The dashboard and calendar update immediately.'], ['Download a backup', 'Your browser can clear local storage. Keep a JSON copy after setup and before changing devices.']] },
    today: { title: 'Today', intro: 'Use this when the full month feels too loud.', cards: [['Right now', 'Log a purchase or choose No spending today. Both count as a daily check-in; no-spend entries never add a fake transaction.'], ['Today’s budget guide', 'The current month’s planned balance divided by the days left, including today. It includes scheduled income and is not your bank balance. Browsing other months does not change this number.'], ['Your last seven days', 'Logged spending, days checked in, and the largest category. The comparison uses the previous seven days of saved entries.'], ['Three small steps', 'A simple checklist based on saved spending, bill status and savings contributions. No points, levels or streak pressure.'], ['Brain dump', 'A private local note area. It never changes any money calculation.'], ['Run to payday', 'The monthly plan left divided by days until the next saved or forecast payday. Scheduled income may not have arrived yet.']] },
    month: { title: 'Planner', intro: 'One paycheck or the whole month — you choose.', cards: [['Paycheck budget', 'Select a dated paycheck to see income, assigned bills, spending, savings, debt payments, total used and remaining. Paycheck only hides the monthly overview.'], ['Fund your bills', 'Choose a paycheck beside each bill. Bills can use a paycheck from another month. Each bill occurrence belongs to one paycheck, and counts as assigned even before it is marked paid.'], ['Link spending', 'Use + Spending inside your paycheck, assign an existing expense, or select a paycheck in the spending form. Editing moves the same record; it never makes a second expense.'], ['Allowances without double counting', 'Debt and savings payments consume their optional allowances. Linked spending consumes Other. Remaining equals income minus used/assigned minus unspent allowances. Actual spending beyond a target also reduces Remaining.'], ['Savings and debt activity', 'Account transactions linked to a paycheck appear here too. Edit either copy to update the same underlying record and both balances. Returned savings credits the paycheck; withdrawals used outside the paycheck do not reduce it again.'], ['History across years', 'Exact dated records stay saved. Use the month rail and year arrows to revisit them. These are planning figures, not a bank connection.']] },
    bills: { title: 'Bills', intro: 'List what is due and mark it only when it really happens.', cards: [['Monthly or one time', 'Monthly bills repeat in each month view; one-time bills stay with the selected month. Days such as the 31st use the last day in shorter months.'], ['Paid state', 'Each month keeps its own payment status. Paying September never marks October paid. Legacy undated payment flags are kept in the month saved by the old app.'], ['Autopay reminder', 'A label only—it does not connect to or move money.']] },
    goals: { title: 'Goals', intro: 'Every balance has a dated trail.', cards: [['Savings accounts', 'Each goal shows its target, current saved balance, remaining amount and progress. Add money increases the balance. Withdraw money decreases it without deleting the goal.'], ['Withdraw or return', 'A withdrawal records money spent from savings only; do not log it again as everyday spending. Return to budget credits the monthly guide when Keep deposits out is enabled. A linked return also credits that paycheck.'], ['Debt accounts', 'Each card shows starting debt, total paid, current remaining balance and progress. Add payment reduces debt. Add debt / charge increases it without changing Total paid. APR is a reference; interest is not calculated automatically.'], ['Edit or delete a transaction', 'Expand Transaction history. Edit the amount, date, note or paycheck link. Later balances and the linked paycheck recalculate from the same record. Delete asks for confirmation and offers immediate Undo. Invalid negative historical balances are blocked.'], ['Balance corrections', 'Corrections are signed, dated transactions, not silent balance overwrites. They do not count as income, spending or payments. Older starting balances have no invented dates.']] },
    settings: { title: 'Settings', intro: 'Personalize the app and keep your local data portable.', cards: [['You & money', 'Name, title, checking, set-aside amount, usual paycheck, and currency.'], ['Payday', 'A recurrence forecast that never pretends money has arrived.'], ['Theme Studio', 'Independent colors, readable fonts, handwriting accents, Night Mode, and Extra Calm Mode.'], ['Backup & restore', 'Export one JSON file and restore it through the same migration layer.'], ['Print / PDF', 'Choose month, sections, paper size, and ink-saver mode; the browser makes the PDF.']] },
    everywhere: { title: 'Everywhere', intro: 'These controls are available across the planner.', cards: [['Quick Actions', 'Press ⌘K or Ctrl K to jump to a screen or type something like “25 groceries”.'], ['Help dots', 'Turn Help on to reveal contextual question marks, then turn it off when you are comfortable.'], ['Focus Mode', 'On Today, temporarily hides everything except the next tiny action.'], ['Privacy view', 'Hides values on screen. It is visual privacy, not encryption.'], ['Month rail', 'Use the colored tabs and year arrows to move through an undated planner.']] }
  }
  const renderHelp = () => {
    const key = GUIDE_CONTENT[state.ui.helpSection] ? state.ui.helpSection : 'start'; const content = GUIDE_CONTENT[key]; state.ui.helpSection = key
    $$('[data-guide-section]').forEach((button) => { const active = button.dataset.guideSection === key; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)) })
    $('#helpGuide').innerHTML = `<div class="guide-section-heading"><span class="eyebrow">${esc(content.title)}</span><h2>${esc(content.intro)}</h2><small>${content.cards.length} quick notes</small></div><div class="guide-card-grid">${content.cards.map(([title, copy], index) => `<article class="paper-card guide-card"><span>${String(index + 1).padStart(2, '0')}</span><h3>${esc(title)}</h3><p>${esc(copy)}</p></article>`).join('')}</div>`
  }
  const renderSettings = () => {
    const lastBackup = state.ui.lastBackupAt
    $('#backupStatus').textContent = lastBackup && Number.isFinite(Date.parse(lastBackup)) ? `Last backup export: ${new Date(lastBackup).toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' })}. Keep the downloaded file somewhere safe.` : 'No recent backup export recorded. Download a recovery copy before changing devices.'
    const savedNotes = Object.values(state.monthNotes).reduce((sum, notes) => sum + notes.length, 0)
    const ledgerEntries = state.goals.reduce((sum, item) => sum + item.contributions.length, 0) + state.debts.reduce((sum, item) => sum + item.history.length, 0)
    $('#savedDataSummary').textContent = `Saved here: ${state.paydays.length} paychecks · ${state.bills.length} bills · ${state.expenses.length} spending entries · ${ledgerEntries} savings/debt transactions · ${savedNotes} kept notes. JSON includes every saved month and year; CSV contains spending only.`
    $('#profileName').value = state.profile.name || ''; $('#plannerTitle').value = state.profile.title || ''; $('#checkingBalance').value = num(state.profile.checking) || ''; $('#setAside').value = num(state.profile.setAside) || ''; $('#currencySelect').value = state.currency; $$('[data-depth]').forEach((button) => button.classList.toggle('active', button.dataset.depth === state.profile.depth)); renderPaydaySettings()
    const steps = [{ done: Boolean(state.profile.name), label: 'Add the name you like seeing', action: 'profile', button: 'Add name' }, { done: incomeFor() > 0, label: 'Add this month’s money in', action: 'income', button: 'Open money in' }, { done: state.bills.length > 0, label: 'List one regular bill', action: 'bills', button: 'Open bills' }, { done: Boolean(num(state.profile.checking)), label: 'Type your current checking balance', action: 'checking', button: 'Add balance' }]; const done = steps.filter((step) => step.done).length
    $('#setupScore').textContent = `${done} of 4`; $('#setupProgressBar').style.width = `${done / 4 * 100}%`; $('#setupList').innerHTML = steps.map((step, index) => `<div class="setup-row${step.done ? ' done' : ''}"><i>${step.done ? '✓' : index + 1}</i><span><strong>${step.label}</strong><small>${step.done ? 'Done — change it anytime.' : 'One small setup step.'}</small></span>${step.done ? '<b>DONE</b>' : `<button type="button" data-setup-action="${step.action}">${step.button}</button>`}</div>`).join('')
    $('#printMonth').value = state.ui.printMonth; $('#paperSize').value = state.ui.paperSize; $('#inkSaver').checked = state.ui.inkSaver; $('#printAllHistory').checked = state.ui.printAllHistory
    if (!state.paydays.some(row => row.id === state.ui.printPaycheck)) state.ui.printPaycheck = ''
    $('#printPaycheck').innerHTML = '<option value="">All paychecks in the selected period</option>' + [...state.paydays].sort((a, b) => b.date.localeCompare(a.date)).map(row => `<option value="${esc(row.id)}"${state.ui.printPaycheck === row.id ? ' selected' : ''}>${esc(row.name)} · ${esc(row.date)}</option>`).join('')
    $$('[data-print-section]').forEach((input) => { input.checked = Boolean(state.ui.printSections[input.dataset.printSection]) }); renderPrint()
  }
  const renderAll = () => {
    applyTheme(); renderMonthRail(); renderSummary(); renderCheckins(); renderMonth(); renderToday(); renderBills(); renderIncome(); financeUI.render(); renderGoals(); renderDebts(); renderEnvelopes(); renderMilestones(); renderTheme(); renderHelp(); renderSettings(); $('#exampleBanner').hidden = !state.profile.sampleData || state.profile.sampleDismissed; $('#helpButton').classList.toggle('active', state.ui.helpMode); $('#helpButton').setAttribute('aria-pressed', String(state.ui.helpMode)); $('#focusButton').classList.toggle('active', state.ui.focusMode); $('#focusButton').setAttribute('aria-pressed', String(state.ui.focusMode))
  }

  const switchView = (view, keepScroll = false) => {
    if (!VIEW_META[view]) return; if (state.profile.depth === 'simple' && ['income', 'debt', 'envelopes', 'milestones'].includes(view)) view = 'today'; activeView = view
    renderFocusState()
    $$('[data-view-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.viewPanel === view)); $$('.nav-button[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view)); $('#activeViewIcon').textContent = VIEW_META[view][0]; $('#activeViewLabel').textContent = VIEW_META[view][1]; appShell.classList.toggle('focus-mode', state.ui.focusMode && view === 'today'); sidebar.classList.remove('open'); $('#mobileScrim').classList.remove('show'); history.replaceState(null, '', `#screen-${view}`); if (!keepScroll) scrollTo({ top: 0, behavior: state.theme.calmMode ? 'auto' : 'smooth' })
  }
  const changeMonth = (delta) => { const { year, monthIndex } = parts(); const target = new Date(year, monthIndex + delta, 1); state.selectedMonth = monthKey(target); state.selectedDate = `${state.selectedMonth}-01`; state.ui.printMonth = state.selectedMonth; save(); if (activeView === 'today') switchView('month'); renderAll() }
  const openExpense = (date = currentDate, item = null, paycheckId = '') => { const form = $('#expenseForm'); form.reset(); form.elements.id.value = item?.id || ''; form.elements.date.value = item?.date || date; form.elements.time.value = item?.time || ''; form.elements.amount.value = item?.amount || ''; form.elements.category.value = item?.category || 'Groceries'; form.elements.note.value = item?.note || ''; form.elements.paycheckId.innerHTML = financeUI.payOptions(item?.paycheckId || paycheckId); $('#expenseSubmitButton').textContent = item ? 'Save changes' : 'Save spending'; quickDialog.showModal(); setTimeout(() => form.elements.amount.focus(), 30) }
  const resetBillForm = () => { const form = $('#billForm'); form.reset(); form.elements.id.value = ''; $('#billSubmitButton').textContent = 'Add bill'; $('#billCancelEdit').hidden = true }
  const resetIncomeForm = () => { const form = $('#incomeForm'); form.reset(); form.elements.id.value = ''; form.elements.date.value = currentDate; $('#incomeSubmitButton').textContent = 'Record money in'; $('#incomeCancelEdit').hidden = true }
  const removeWithUndo = (collection, id, label) => { const index = collection.findIndex((item) => item.id === id); if (index < 0) return; const [removed] = collection.splice(index, 1); save(); renderAll(); toast(`${label} removed`, 'Undo', () => { collection.splice(index, 0, removed); save(); renderAll(); toast(`${label} restored`) }) }

  const renderCommands = () => {
    const query = $('#commandInput').value.trim().toLowerCase(); const screens = Object.entries(VIEW_META).filter(([key]) => state.profile.depth === 'full' || !['income', 'debt', 'envelopes', 'milestones'].includes(key)).map(([view, meta]) => ({ icon: meta[0], label: `Open ${meta[1]}`, detail: 'Go to screen', action: () => switchView(view) })); const actions = [{ icon: '＋', label: 'Log spending', detail: 'Open quick capture', action: () => openExpense(currentDate) }, { icon: '⌁', label: 'Add a bill', detail: 'Open bills and focus the form', action: () => { switchView('bills'); setTimeout(() => $('#billForm [name="name"]').focus(), 80) } }, { icon: '⇩', label: 'Download backup', detail: 'Save a portable JSON copy', action: () => $('#downloadBackup').click() }]
    const match = query.match(/^(\d+(?:[.,]\d{1,2})?)\s*(.*)$/); const amountAction = match ? [{ icon: '＋', label: `Log ${money(Number(match[1].replace(',', '.')))}`, detail: match[2] || 'Other', action: () => { const words = match[2]; const category = CATEGORIES.find((item) => words.includes(item.toLowerCase().split(' ')[0])) || (words.includes('coffee') || words.includes('lunch') ? 'Eating out' : 'Other'); const amount = Number(match[1].replace(',', '.')); state.expenses.push({ id: uid(), date: currentDate, time: new Date().toTimeString().slice(0, 5), amount, category, note: words || category }); state.profile.sampleData = false; save(); renderAll(); toast(`${money(amount)} logged to ${category}`) } }] : []
    const pool = [...amountAction, ...actions, ...screens]; commandItems = query ? pool.filter((item) => amountAction.includes(item) || `${item.label} ${item.detail}`.toLowerCase().includes(query)) : pool; commandIndex = clamp(commandIndex, 0, Math.max(0, commandItems.length - 1)); $('#commandResults').innerHTML = commandItems.length ? commandItems.map((item, index) => `<button type="button" role="option" data-command-index="${index}" class="${index === commandIndex ? 'selected' : ''}" aria-selected="${index === commandIndex}"><i>${item.icon}</i><span><strong>${esc(item.label)}</strong><small>${esc(item.detail)}</small></span><b>↵</b></button>`).join('') : '<p class="empty-copy">No match. Try a screen name or “25 groceries”.</p>'
  }
  const runCommand = (index = commandIndex) => { const item = commandItems[index]; if (item) { commandDialog.close(); item.action() } }
  const openCommand = () => { $('#commandInput').value = ''; commandIndex = 0; renderCommands(); commandDialog.showModal(); setTimeout(() => $('#commandInput').focus(), 30) }
  const bindDelegatedEvents = () => document.addEventListener('click', (event) => {
    const insight = event.target.closest('[data-insight-group]')
    if (insight) { const selector=insight.dataset.insightHost; insightSelection[selector]=insight.dataset.insightGroup; renderInsights(selector,selector==='#todayInsights'?currentMonth:state.selectedMonth); $(`${selector} [data-insight-group="${insight.dataset.insightGroup}"]`).focus() }
    const insightDay = event.target.closest('[data-insight-day]')
    if (insightDay) { journalDate=insightDay.dataset.insightDay; switchView('today'); renderDayJournal(); $('#today-journal').scrollIntoView({block:'start'}); $('#journalDate').focus({preventScroll:true}) }
    const insightOpen = event.target.closest('[data-insight-open]')
    if (insightOpen) { state.selectedMonth=insightOpen.dataset.insightMonth; state.selectedDate=state.selectedMonth+'-01'; save(); renderAll(); switchView(insightOpen.dataset.insightOpen) }
    const editNote = event.target.closest('[data-month-note-edit]'); if (editNote) { const note = (state.monthNotes[state.selectedMonth] || []).find(item => item.id === editNote.dataset.monthNoteEdit); if (note) { editingMonthNote = { id:note.id, month:state.selectedMonth, text:note.text }; $('#monthNote').value = note.text; renderMonthNotes(); $('#monthNote').focus() } }
    const removeNote = event.target.closest('[data-month-note-remove]'); if (removeNote) { editingMonthNote = null; removeWithUndo(state.monthNotes[state.selectedMonth] || [], removeNote.dataset.monthNoteRemove, 'Note') }
    const journalDay = event.target.closest('[data-journal-day]'); if (journalDay) { journalDate = journalDay.dataset.journalDay; renderDayJournal(); $('#today-journal').scrollIntoView({ block: 'start' }) }
    const upcoming = event.target.closest('[data-upcoming-date]'); if (upcoming) { state.selectedMonth = upcoming.dataset.upcomingDate.slice(0, 7); state.selectedDate = upcoming.dataset.upcomingDate; save(); renderAll(); switchView(upcoming.dataset.upcomingView) }
    const viewButton = event.target.closest('[data-view]'); const goButton = event.target.closest('[data-go-view]'); const quest = event.target.closest('[data-quest-view]')
    if (viewButton) switchView(viewButton.dataset.view)
    if (goButton) switchView(goButton.dataset.goView)
    if (quest) { switchView(quest.dataset.questView); if (quest.dataset.questView === 'today' && !questDone('spend')) $('#rightNowButton').focus() }
    const monthButton = event.target.closest('[data-month]')
    if (monthButton) { state.selectedMonth = monthButton.dataset.month; state.selectedDate = `${state.selectedMonth}-01`; state.ui.printMonth = state.selectedMonth; save(); if (activeView === 'today') switchView('month'); renderAll() }
    const dayButton = event.target.closest('[data-date]')
    if (dayButton) { state.selectedDate = dayButton.dataset.date; save(); renderCalendar() }
    const guideButton = event.target.closest('[data-guide-section]')
    if (guideButton) { state.ui.helpSection = guideButton.dataset.guideSection; save(); renderHelp() }

    const expenseEdit = event.target.closest('[data-expense-edit]'); const expenseRemove = event.target.closest('[data-expense-remove]')
    if (expenseEdit) { const item = state.expenses.find((row) => row.id === expenseEdit.dataset.expenseEdit); if (item) openExpense(item.date, item) }
    if (expenseRemove) removeWithUndo(state.expenses, expenseRemove.dataset.expenseRemove, 'Spending')
    const billToggle = event.target.closest('[data-bill-toggle]'); const billEdit = event.target.closest('[data-bill-edit]'); const billRemove = event.target.closest('[data-bill-remove]')
    if (billToggle) { const bill = state.bills.find((item) => item.id === billToggle.dataset.billToggle); if (bill) { bill.paidMonths ||= {}; const billMonth = billToggle.dataset.billMonth || state.selectedMonth; const paid = !bill.paidMonths[billMonth]; bill.paidMonths[billMonth] = paid; state.profile.sampleData = false; save(); renderAll(); toast(`${bill.name} marked ${paid ? 'paid' : 'open'} for ${billMonth}`) } }
    if (billEdit) { switchView('bills'); const bill = state.bills.find((item) => item.id === billEdit.dataset.billEdit); if (bill) { const form = $('#billForm'); form.elements.id.value = bill.id; form.elements.name.value = bill.name; form.elements.amount.value = bill.amount; form.elements.due.value = bill.due; form.elements.frequency.value = bill.frequency; form.elements.autopay.checked = bill.autopay; $('#billSubmitButton').textContent = 'Save bill'; $('#billCancelEdit').hidden = false; form.scrollIntoView({ behavior: 'smooth', block: 'center' }) } }
    if (billRemove) removeWithUndo(state.bills, billRemove.dataset.billRemove, 'Bill')

    const incomeEdit = event.target.closest('[data-income-edit]'); const incomeRemove = event.target.closest('[data-income-remove]')
    if (incomeEdit) { switchView('income'); const [kind, id] = incomeEdit.dataset.incomeEdit.split(':'); const item = (kind === 'payday' ? state.paydays : state.moneyIn).find((row) => row.id === id); if (item) { const form = $('#incomeForm'); form.elements.id.value = `${kind}:${id}`; form.elements.kind.value = kind; form.elements.name.value = item.name; form.elements.amount.value = item.amount; form.elements.date.value = item.date; $('#incomeSubmitButton').textContent = 'Save income'; $('#incomeCancelEdit').hidden = false; form.scrollIntoView({ behavior: 'smooth', block: 'center' }) } }
    if (incomeRemove) { const [kind, id] = incomeRemove.dataset.incomeRemove.split(':'); if (kind === 'payday' && BudgetFinance.referenced(state, id)) { toast('This paycheck has a plan or linked activity. Clear its allocations and remove linked transactions before deleting it.'); return } delete state.paycheckPlans[id]; removeWithUndo(kind === 'payday' ? state.paydays : state.moneyIn, id, 'Income') }

    const goalAdd = event.target.closest('[data-goal-add]'); const goalKeep = event.target.closest('[data-goal-keepout]'); const goalEdit = event.target.closest('[data-goal-edit]'); const goalRemove = event.target.closest('[data-goal-remove]')
    if (goalAdd) financeUI.openActivity('goal', goalAdd.dataset.goalAdd, 'deposit')
    if (goalKeep) { const goal = state.goals.find((item) => item.id === goalKeep.dataset.goalKeepout); if (goal) { goal.keepOut = goalKeep.checked; save(); renderAll(); toast(goal.keepOut ? 'Goal deposits reduce safe-to-use' : 'Goal deposits excluded from safe-to-use') } }
    if (goalEdit) financeUI.openEdit('goal', goalEdit.dataset.goalEdit)
    if (goalRemove) removeWithUndo(state.goals, goalRemove.dataset.goalRemove, 'Goal')

    const debtPay = event.target.closest('[data-debt-pay]'); const debtEdit = event.target.closest('[data-debt-edit]'); const debtRemove = event.target.closest('[data-debt-remove]')
    if (debtPay) financeUI.openActivity('debt', debtPay.dataset.debtPay, 'payment')
    if (debtEdit) financeUI.openEdit('debt', debtEdit.dataset.debtEdit)
    if (debtRemove) removeWithUndo(state.debts, debtRemove.dataset.debtRemove, 'Debt')

    const envelopeEdit = event.target.closest('[data-envelope-edit]'); const envelopeRemove = event.target.closest('[data-envelope-remove]')
    if (envelopeEdit) { const item = state.envelopes.find((row) => row.id === envelopeEdit.dataset.envelopeEdit); if (item) { const cap = prompt('Monthly cap', item.cap); if (cap === null || num(cap) <= 0) return; item.cap = num(cap); save(); renderAll(); toast('Envelope updated') } }
    if (envelopeRemove) removeWithUndo(state.envelopes, envelopeRemove.dataset.envelopeRemove, 'Envelope')
    const brainRemove = event.target.closest('[data-brain-remove]')
    if (brainRemove) removeWithUndo(state.brainDump, brainRemove.dataset.brainRemove, 'Thought')

    const help = event.target.closest('[data-help-title]')
    if (help) { $('#helpTitle').textContent = help.dataset.helpTitle; $('#helpText').textContent = help.dataset.helpText; helpDialog.showModal() }
    const preset = event.target.closest('[data-preset]')
    if (preset) { Object.assign(state.theme, JSON.parse(preset.dataset.preset)); save(); renderAll(); toast('Palette applied') }
    const filter = event.target.closest('[data-milestone-filter]')
    if (filter) { state.ui.milestoneFilter = filter.dataset.milestoneFilter; save(); renderMilestones() }
    const depth = event.target.closest('[data-depth]')
    if (depth) { state.profile.depth = depth.dataset.depth; if (state.profile.depth === 'simple' && ['income', 'debt', 'envelopes', 'milestones'].includes(activeView)) switchView('today'); save(); renderAll(); toast(state.profile.depth === 'simple' ? 'Simple navigation on' : 'Everything included') }
    const setup = event.target.closest('[data-setup-action]')
    if (setup) { const action = setup.dataset.setupAction; if (action === 'profile' || action === 'checking') { switchView('settings'); setTimeout(() => $(action === 'profile' ? '#profileName' : '#checkingBalance').focus(), 50) } else switchView(action) }
    const command = event.target.closest('[data-command-index]')
    if (command) runCommand(Number(command.dataset.commandIndex))
  })

  const bindForms = () => {
    $('#expenseForm').addEventListener('submit', (event) => {
      event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); const item = { id: data.id || uid(), date: data.date, time: data.time || '', amount: num(data.amount), category: data.category, note: data.note.trim(), paycheckId: data.paycheckId || '' }
      if (data.id) { const index = state.expenses.findIndex((row) => row.id === data.id); if (index >= 0) state.expenses[index] = item } else state.expenses.push(item)
      state.profile.sampleData = false; state.selectedMonth = item.date.slice(0, 7); state.selectedDate = item.date; state.noSpendDays = state.noSpendDays.filter((day) => day !== item.date); financeUI.selectPaycheck(item.paycheckId); quickDialog.close(); save(); renderAll(); toast(data.id ? 'Spending updated' : `${money(item.amount)} saved`)
    })
    $('#billForm').addEventListener('submit', (event) => {
      event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); const existing = state.bills.find((item) => item.id === data.id); const bill = { id: data.id || uid(), name: data.name.trim(), amount: num(data.amount), due: clamp(Math.round(num(data.due)), 1, 31), frequency: data.frequency, autopay: form.elements.autopay.checked, paid: existing?.paid || false, month: data.frequency === 'once' ? (existing?.month || state.selectedMonth) : undefined }
      if (existing) Object.assign(existing, bill); else state.bills.push(bill); state.profile.sampleData = false; resetBillForm(); save(); renderAll(); toast(existing ? 'Bill updated' : 'Bill added')
    })
    $('#incomeForm').addEventListener('submit', (event) => {
      event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); let previousKind; let previousId
      if (data.id) [previousKind, previousId] = data.id.split(':')
      if (previousKind === 'payday' && data.kind !== 'payday' && BudgetFinance.referenced(state, previousId)) { toast('Keep this as a paycheck while it has a plan or linked activity.'); return }
      if (previousKind === 'payday' && data.kind !== 'payday') delete state.paycheckPlans[previousId]
      if (previousId) { const previous = previousKind === 'payday' ? state.paydays : state.moneyIn; const index = previous.findIndex((item) => item.id === previousId); if (index >= 0) previous.splice(index, 1) }
      const item = { id: previousId || uid(), name: data.name.trim(), amount: num(data.amount), date: data.date }; (data.kind === 'payday' ? state.paydays : state.moneyIn).push(item); state.profile.sampleData = false; state.selectedMonth = item.date.slice(0, 7); resetIncomeForm(); save(); renderAll(); toast(previousId ? 'Income updated' : 'Money in recorded')
    })
    $('#goalForm').addEventListener('submit', (event) => { event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); state.goals.push({ id: uid(), name: data.name.trim(), target: num(data.target), saved: Math.max(0, num(data.saved)), monthly: Math.max(0, num(data.monthly)), keepOut: true, contributions: [] }); state.profile.sampleData = false; form.reset(); form.elements.saved.value = 0; form.elements.monthly.value = 25; save(); renderAll(); toast('Goal created') })
    $('#debtForm').addEventListener('submit', (event) => { event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); const balance = num(data.balance); state.debts.push({ id: uid(), name: data.name.trim(), startingBalance: balance, openingBalance: balance, balance, apr: Math.max(0, num(data.apr)), payment: Math.max(0, num(data.payment)), history: [] }); state.profile.sampleData = false; form.reset(); save(); renderAll(); toast('Debt added') })
    $('#envelopeForm').addEventListener('submit', (event) => { event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); state.envelopes.push({ id: uid(), name: data.name.trim(), category: data.category, cap: num(data.cap) }); state.profile.sampleData = false; form.reset(); save(); renderAll(); toast('Envelope added') })
    $('#brainDumpForm').addEventListener('submit', (event) => { event.preventDefault(); const input = $('#brainDumpInput'); const text = input.value.trim(); if (!text) return; state.brainDump.unshift({ id: uid(), text }); input.value = ''; save(); renderToday(); toast('Thought parked') })
  }

  const bindControls = () => {
    $('#welcomeNameForm').addEventListener('submit', event => {
      event.preventDefault()
      const error = storeWelcomeName($('#welcomeName').value)
      $('#welcomeNameError').textContent = error
      $('#welcomeName').setAttribute('aria-invalid', error ? 'true' : 'false')
      if (error) { $('#welcomeName').focus(); return }
      renderAll(); playLaunch(welcomeForce, true)
    })
    $('#keepMonthNote').addEventListener('click', () => {
      const text = $('#monthNote').value.trim(); if (!text) { toast('Write a note first.'); $('#monthNote').focus(); return }
      const list = state.monthNotes[state.selectedMonth] ||= []; const existing = editingMonthNote && list.find(note => note.id === editingMonthNote.id)
      if (existing) { existing.text = text; existing.updatedAt = new Date().toISOString() } else { list.push({ id:uid(), date:currentDate, text, savedAt:new Date().toISOString() }); state.notes[state.selectedMonth] = '' }
      editingMonthNote = null; save(); renderAll(); toast('Note kept with this month')
    })
    $('#cancelMonthNoteEdit').addEventListener('click', () => { editingMonthNote = null; $('#monthNote').value = state.notes[state.selectedMonth] || ''; renderMonthNotes() })
    $('#journalPrevious').addEventListener('click', () => { journalDate = shiftDay(journalDate, -1); renderDayJournal() })
    $('#journalNext').addEventListener('click', () => { journalDate = shiftDay(journalDate, 1); renderDayJournal() })
    $('#journalToday').addEventListener('click', () => { journalDate = currentDate; renderDayJournal() })
    $('#journalDate').addEventListener('change', event => { if (BudgetFinance.validDate(event.target.value)) journalDate = event.target.value; renderDayJournal() })
    $('#previousMonth').addEventListener('click', () => changeMonth(-1)); $('#nextMonth').addEventListener('click', () => changeMonth(1)); $('#railPreviousYear').addEventListener('click', () => changeMonth(-12)); $('#railNextYear').addEventListener('click', () => changeMonth(12))
    $('#todayMonth').addEventListener('click', () => { state.selectedMonth = currentMonth; state.selectedDate = currentDate; state.ui.printMonth = currentMonth; save(); renderAll() })
    $('#menuButton').addEventListener('click', () => { sidebar.classList.add('open'); $('#mobileScrim').classList.add('show') }); $('#mobileScrim').addEventListener('click', () => { sidebar.classList.remove('open'); $('#mobileScrim').classList.remove('show') })
    $('#agendaToggle').addEventListener('click', () => { state.ui.agendaOpen = !state.ui.agendaOpen; save(); renderAgenda() })
    $('#privacyButton').addEventListener('click', () => { state.privateMode = !state.privateMode; save(); renderAll() })
    $('#quickAddButton').addEventListener('click', () => openExpense(activeView === 'today' || state.selectedMonth === currentMonth ? currentDate : state.selectedDate)); $('#todayLogButton').addEventListener('click', () => openExpense(currentDate)); $('#todayRegisterAdd').addEventListener('click', () => openExpense(journalDate)); $('#rightNowButton').addEventListener('click', () => { const hasToday = state.expenses.some((item) => item.date === currentDate) || state.noSpendDays.includes(currentDate); const open = billsFor(currentMonth).find((item) => !item.paid); if (hasToday && open) { state.selectedMonth = currentMonth; state.selectedDate = currentDate; save(); renderAll(); switchView('bills') } else openExpense(currentDate) })
    $('#exitFocus').addEventListener('click', () => setFocus(false))
    $('#registerSearch').addEventListener('input', renderFilteredRegister); $('#registerCategory').addEventListener('change', renderFilteredRegister); $('#clearRegisterFilters').addEventListener('click', () => { $('#registerSearch').value = ''; $('#registerCategory').value = ''; renderFilteredRegister(); $('#registerSearch').focus() })
    $('#noSpendButton').addEventListener('click', () => { const index = state.noSpendDays.indexOf(currentDate); if (index >= 0) state.noSpendDays.splice(index, 1); else if (!state.expenses.some((item) => item.date === currentDate)) state.noSpendDays.push(currentDate); state.profile.sampleData = false; save(); renderAll(); toast(index < 0 ? 'Daily check-in saved' : 'No-spend check-in undone') })
    $$('[data-quick-spend]').forEach((button) => button.addEventListener('click', () => { const amount = num(button.dataset.quickSpend); const id = uid(); state.expenses.push({ id, date: currentDate, time: new Date().toTimeString().slice(0, 5), amount, category: button.dataset.quickCategory, note: button.dataset.quickNote }); state.profile.sampleData = false; save(); renderAll(); toast(`${money(amount)} ${button.dataset.quickNote.toLowerCase()} logged`, 'Undo', () => { const index = state.expenses.findIndex((item) => item.id === id); if (index >= 0) state.expenses.splice(index, 1); save(); renderAll(); toast('Quick spend removed') }) }))
    $('#closeDialog').addEventListener('click', () => quickDialog.close()); $$('[data-amount-key]').forEach((button) => button.addEventListener('click', () => { const input = $('#expenseForm [name="amount"]'); input.value = (num(input.value) + num(button.dataset.amountKey)).toFixed(2); input.focus() })); $('[data-amount-clear]').addEventListener('click', () => { $('#expenseForm [name="amount"]').value = ''; $('#expenseForm [name="amount"]').focus() }); $('#billCancelEdit').addEventListener('click', resetBillForm); $('#incomeCancelEdit').addEventListener('click', resetIncomeForm)
    $('#monthNote').addEventListener('input', (event) => { if (editingMonthNote) { editingMonthNote.text = event.target.value; $('#noteSaved').textContent = 'Editing · save changes below'; return } state.notes[state.selectedMonth] = event.target.value; save(); $('#noteSaved').textContent = 'Draft saved' }); $('#todayIntention').addEventListener('input', (event) => { state.dailyIntentions[currentDate] = { text: event.target.value, savedAt: new Date().toISOString() }; save(); renderDayJournal() })
    $('#keepExampleButton').addEventListener('click', () => { state.profile.sampleDismissed = true; save(); $('#exampleBanner').hidden = true }); $('#startFreshButton').addEventListener('click', () => { const theme = clone(state.theme); state = blankState(); state.theme = theme; save(); renderAll(); switchView('settings'); toast('Fresh planner ready — add your first number') })
    ;[['profileName', 'name'], ['plannerTitle', 'title'], ['checkingBalance', 'checking'], ['setAside', 'setAside']].forEach(([id, key]) => $(`#${id}`).addEventListener('input', (event) => { state.profile[key] = ['checking', 'setAside'].includes(key) ? num(event.target.value) : event.target.value; state.profile.sampleData = false; save(); if (key === 'name') renderToday() }))
    $('#usualPaycheck').addEventListener('input', (event) => { state.profile.usualPaycheck = num(event.target.value); state.profile.sampleData = false; save() }); $('#usualPaycheck').addEventListener('change', renderAll)
    $('#payCycle').addEventListener('change', (event) => { state.profile.payCycle = event.target.value; save(); renderAll() }); $('#payAnchor').addEventListener('change', (event) => { state.profile.payAnchor = event.target.value; save(); renderAll() }); $('#weekendEarly').addEventListener('change', (event) => { state.profile.weekendEarly = event.target.checked; save(); renderAll() })
    $('#currencySelect').addEventListener('change', (event) => { state.currency = event.target.value; save(); renderAll(); toast(`Currency set to ${state.currency}`) })
    ;[['mainColor', 'main'], ['accentColor', 'accent'], ['backgroundColor', 'canvas'], ['bodyFont', 'bodyFont'], ['headingFont', 'headingFont'], ['handwritingFont', 'handwritingFont']].forEach(([id, key]) => $(`#${id}`).addEventListener('input', (event) => { state.theme[key] = event.target.value; save(); applyTheme(); renderTheme() }))
    $$('input[name="handScope"]').forEach((input) => input.addEventListener('change', () => { if (input.checked) { state.theme.handScope = input.value; save(); applyTheme() } })); $('#nightMode').addEventListener('change', (event) => { state.theme.nightMode = event.target.checked; save(); applyTheme() }); $('#calmMode').addEventListener('change', (event) => { state.theme.calmMode = event.target.checked; save(); applyTheme() }); $('#resetTheme').addEventListener('click', () => { state.theme = clone(baseTheme); save(); renderAll(); toast('Theme reset') })
    $('#helpButton').addEventListener('click', () => { state.ui.helpMode = !state.ui.helpMode; save(); applyTheme(); $('#helpButton').classList.toggle('active', state.ui.helpMode); $('#helpButton').setAttribute('aria-pressed', String(state.ui.helpMode)); toast(state.ui.helpMode ? 'Context help dots are on' : 'Context help dots are hidden') }); $('#focusButton').addEventListener('click', () => setFocus(!state.ui.focusMode)); $('#closeHelp').addEventListener('click', () => helpDialog.close()); $('#helpDone').addEventListener('click', () => helpDialog.close())
    $('#skipLaunch').addEventListener('click', () => closeLaunch(false)); $('#enterLaunch').addEventListener('click', () => closeLaunch(false)); $('#replayLaunch').addEventListener('click', () => playLaunch(true))
    $('#pauseLaunch').addEventListener('click', () => { const paused = $('#pauseLaunch').getAttribute('aria-pressed') !== 'true'; launchScreen.classList.toggle('launch-paused', paused); $('#pauseLaunch').setAttribute('aria-pressed', String(paused)); $('#pauseLaunch').textContent = paused ? 'Resume motion' : 'Pause motion' })
    $('#printGuide').addEventListener('click', () => { document.body.classList.add('print-guide'); print() })
    $('#commandPaletteButton').addEventListener('click', openCommand); $('#closeCommand').addEventListener('click', () => commandDialog.close()); $('#commandInput').addEventListener('input', () => { commandIndex = 0; renderCommands() }); $('#commandInput').addEventListener('keydown', (event) => { if (event.key === 'ArrowDown') { event.preventDefault(); commandIndex = (commandIndex + 1) % Math.max(1, commandItems.length); renderCommands() } if (event.key === 'ArrowUp') { event.preventDefault(); commandIndex = (commandIndex - 1 + Math.max(1, commandItems.length)) % Math.max(1, commandItems.length); renderCommands() } if (event.key === 'Enter') { event.preventDefault(); runCommand() } })
    $('#toastAction').addEventListener('click', () => { const callback = undoCallback; undoCallback = null; if (callback) callback() })
  }

  const parseBackup = (text) => {
    const parsed = JSON.parse(text); const candidate = parsed?.state || parsed
    if (!candidate || Array.isArray(candidate) || typeof candidate !== 'object' || !Array.isArray(candidate.bills) || !Array.isArray(candidate.expenses) || !Array.isArray(candidate.goals) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(candidate.selectedMonth || '') || num(candidate.version) > VERSION) throw new Error('Unsupported backup')
    const validDate = (date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(parseDate(date).getTime()) && dateKey(parseDate(date)) === date
    for (const key of ['bills', 'expenses', 'goals', 'paydays', 'moneyIn', 'debts', 'envelopes', 'brainDump']) {
      if (candidate[key] === undefined) continue
      if (!Array.isArray(candidate[key]) || candidate[key].some((row) => !row || typeof row !== 'object' || typeof row.id !== 'string' || !/^[\w-]+$/.test(row.id))) throw new Error('Invalid entries')
    }
    if ([...(candidate.expenses || []), ...(candidate.paydays || []), ...(candidate.moneyIn || [])].some((row) => !validDate(row.date) || !Number.isFinite(Number(row.amount)) || Number(row.amount) < 0)) throw new Error('Invalid dated amounts')
    if (candidate.expenses.some((row) => typeof row.category !== 'string') || candidate.bills.some((row) => !Number.isFinite(Number(row.due)) || row.due < 1 || row.due > 31)) throw new Error('Invalid record')
    for (const key of ['notes', 'monthNotes', 'dailyIntentions']) if (candidate[key] !== undefined && (!candidate[key] || typeof candidate[key] !== 'object' || Array.isArray(candidate[key]))) throw new Error('Invalid note collection')
    const restored = mergeState(candidate); restored.ui.focusMode = false
    for (const [key, entry] of Object.entries(restored.dailyIntentions)) if (!BudgetFinance.validDate(key) || !entry || typeof entry.text !== 'string' || entry.savedAt && !Number.isFinite(Date.parse(entry.savedAt))) throw new Error('Invalid daily note')
    for (const [key, entries] of Object.entries(restored.monthNotes)) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key) || !Array.isArray(entries)) throw new Error('Invalid monthly notes')
      const ids = new Set()
      for (const note of entries) { if (!note || typeof note.id !== 'string' || !/^[\w-]+$/.test(note.id) || ids.has(note.id) || typeof note.text !== 'string' || !BudgetFinance.validDate(note.date)) throw new Error('Invalid kept note'); ids.add(note.id) }
    }
    BudgetFinance.validateState(restored)
    // Validate currency before any live state is replaced.
    new Intl.NumberFormat('en-US', { style: 'currency', currency: restored.currency }).format(0)
    return restored
  }
  const bindDataTools = () => {
    $('#printAllHistory').addEventListener('change', event => { state.ui.printAllHistory = event.target.checked; save(); renderPrint() })
    $('#printPaycheck').addEventListener('change', event => { state.ui.printPaycheck = event.target.value; save(); renderPrint() })
    $('#downloadBackup').addEventListener('click', () => { state.milestones.reached.backup = state.milestones.reached.backup || currentDate; state.ui.lastBackupAt = new Date().toISOString(); save(); downloadBlob(new Blob([JSON.stringify({ app: 'AurelyStudio Monthly Budget Planner', version: VERSION, exportedAt: state.ui.lastBackupAt, state }, null, 2)], { type: 'application/json' }), `aurely-budget-backup-${currentDate}.json`); renderMilestones(); renderSettings(); toast('Backup export started — keep the downloaded file') })
    $('#shareBackup').addEventListener('click', async () => { const blob = new Blob([JSON.stringify({ app: 'AurelyStudio Monthly Budget Planner', version: VERSION, exportedAt: new Date().toISOString(), state }, null, 2)], { type: 'application/json' }); const file = new File([blob], `aurely-budget-backup-${currentDate}.json`, { type: 'application/json' }); if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Aurely budget backup' }); toast('Share sheet opened') } catch (error) { if (error.name !== 'AbortError') toast('Sharing was not available') } } else { downloadBlob(blob, file.name); toast('Sharing is unavailable here, so the backup was downloaded') } })
    $('#restoreBackup').addEventListener('click', () => $('#restoreFile').click()); $('#restoreFile').addEventListener('change', async (event) => { const file = event.target.files?.[0]; if (!file) return; const previous = clone(state); try { const restored = parseBackup(await file.text()); if (!confirm('Replace this browser’s current planner with this backup? Cancel to download a backup of your current planner first.')) return; state = restored; state.profile.sampleData = false; save(); renderAll(); toast('Backup restored', 'Undo', () => { state = previous; save(); renderAll(); toast('Previous planner restored') }) } catch { state = previous; toast('That file is not a supported planner backup. Your current data is unchanged.') } finally { event.target.value = '' } })
    $('#exportCsv').addEventListener('click', () => { const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`; const rows = [['Date', 'Time', 'Category', 'Note', 'Amount'], ...state.expenses.map((item) => [item.date, item.time || '', item.category, item.note || '', num(item.amount).toFixed(2)])]; downloadBlob(new Blob([rows.map((row) => row.map(quote).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }), `aurely-spending-${currentDate}.csv`); toast('Spending CSV exported') })
    $('#eraseData').addEventListener('click', () => { if (!confirm('Erase every planner entry saved in this browser? Download a backup first if you may need it.')) return; localStorage.removeItem(STORAGE_KEY); state = blankState(); save(); renderAll(); switchView('today'); toast('Local planner data erased') })
    $('#printMonth').addEventListener('change', (event) => { state.ui.printMonth = event.target.value || state.selectedMonth; save(); renderPrint() }); $('#paperSize').addEventListener('change', (event) => { state.ui.paperSize = event.target.value; save(); renderPrint() }); $('#inkSaver').addEventListener('change', (event) => { state.ui.inkSaver = event.target.checked; save(); renderPrint() }); $$('[data-print-section]').forEach((input) => input.addEventListener('change', () => { state.ui.printSections[input.dataset.printSection] = input.checked; save(); renderPrint() })); $('#printButton').addEventListener('click', () => { document.body.classList.toggle('print-ink-saver', state.ui.inkSaver); print() })
    $('#installApp').addEventListener('click', async () => { if (installPrompt) { installPrompt.prompt(); const result = await installPrompt.userChoice; installPrompt = null; $('#installHint').textContent = result.outcome === 'accepted' ? 'Install accepted.' : 'Install dismissed. You can try again later.' } else toast('Use your browser menu and choose Install or Add to Home Screen') })
  }

  document.addEventListener('keydown', (event) => {
    if (!launchScreen.hidden && !launchScreen.inert && event.key === 'Tab') { event.preventDefault(); const buttons = (!$('#welcomeNameForm').hidden ? [$('#welcomeName'), $('#continueWelcome'), $('#pauseLaunch')] : [$('#enterLaunch'), $('#pauseLaunch'), $('#skipLaunch')]).filter(button => !button.hidden); const index = buttons.indexOf(document.activeElement); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus(); return }
    if (event.key === 'Escape' && !launchScreen.hidden) { event.preventDefault(); closeLaunch(false); return }
    if (!launchScreen.hidden && !launchScreen.inert) return
    if ($('.finance-dialog[open]')) return
    if (event.key === 'Escape' && state.ui.focusMode && !quickDialog.open && !commandDialog.open && !helpDialog.open) { event.preventDefault(); setFocus(false); return }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openCommand() }
    const day = event.target.closest?.('.calendar-day')
    if (day && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const date = parseDate(day.dataset.date); const weekday = (date.getDay() + 6) % 7; const offset = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -7 : event.key === 'ArrowDown' ? 7 : event.key === 'Home' ? -weekday : 6 - weekday; const target = new Date(date); target.setDate(date.getDate() + offset); const key = dateKey(target); if (key.startsWith(state.selectedMonth)) { state.selectedDate = key; renderCalendar(); setTimeout(() => $(`[data-date="${key}"]`)?.focus(), 0) } }
  })
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event; $('#installHint').textContent = 'This browser is ready to install the planner.' })
  window.addEventListener('appinstalled', () => { installPrompt = null; $('#installHint').textContent = 'Installed on this device.'; toast('Planner installed') })
  window.addEventListener('afterprint', () => { document.body.classList.remove('print-ink-saver'); document.body.classList.remove('print-guide') })
  window.addEventListener('hashchange', () => {
    if (location.hash === '#screen-opening') { playLaunch(true); return }
    if (location.hash.startsWith('#settings-')) {
      const target = document.getElementById(location.hash.slice(1))
      if (target?.closest('#view-settings')) { switchView('settings', true); target.scrollIntoView({ block: 'start' }); return }
    }
    const hashView = location.hash.replace('#screen-', '')
    if (VIEW_META[hashView] && hashView !== activeView) switchView(hashView, true)
  })

  const refreshClock = () => {
    const previousMonth = currentMonth; const previousDate = currentDate
    now = new Date(); currentDate = dateKey(now); currentMonth = monthKey(now)
    if (previousDate === currentDate) { const hour = now.getHours(); $('#todayGreeting').textContent = (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening') + (state.profile.name ? ', ' + state.profile.name : ''); return }
    if (journalDate === previousDate) journalDate = currentDate
    if (state.selectedMonth === previousMonth) { state.selectedMonth = currentMonth; state.selectedDate = currentDate }
    state.ui.focusMode = false; save(); renderAll()
  }
  window.addEventListener('focus', refreshClock)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshClock() })
  setInterval(refreshClock, 60000)

  const financeUI = createFinanceUI({ getState: () => state, save, renderAll, money: masked, esc, uid, today: () => currentDate, switchView, toast, openExpense })
  financeUI.bind()
  EnglishDates.install()
  bindDelegatedEvents(); bindForms(); bindControls(); bindDataTools(); resetIncomeForm(); renderAll()
  const initialHash = location.hash
  const requestedView = initialHash.startsWith('#settings-') ? 'settings' : initialHash.replace('#screen-', '')
  switchView(VIEW_META[requestedView] ? requestedView : 'today', true)
  if (initialHash.startsWith('#settings-')) setTimeout(() => document.querySelector(initialHash)?.scrollIntoView(), 0)
  playLaunch(initialHash === '#screen-opening')
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {})
})()
