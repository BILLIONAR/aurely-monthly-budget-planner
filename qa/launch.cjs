const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

function opening(reduced = false, name = 'Alex', storageFails = false) {
  const nodes = new Map(), timers = new Map(), session = new Map(); let timerId = 0
  const document = { querySelector: selector => node(selector), querySelectorAll: () => [] }
  function node(id) {
    if (!nodes.has(id)) {
      const classes = new Set()
      nodes.set(id, { hidden:false, inert:false, isConnected:true, dataset:{}, style:{setProperty(){}},
        classList:{contains:n=>classes.has(n),add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),toggle:(n,value)=>value?classes.add(n):classes.delete(n)},
        setAttribute(){},removeAttribute(){},focus(){document.activeElement=this}, contains(el){return id === '#launchScreen' && [node('#enterLaunch'),node('#skipLaunch'),node('#welcomeName'),node('#continueWelcome')].includes(el)} })
    }
    return nodes.get(id)
  }
  document.body = node('body'); document.activeElement = node('#replayLaunch')
  const scope = { document, BudgetFinance:require('../finance.js'), Date, Intl, console,
    localStorage:{getItem:()=>null,setItem(){if(storageFails)throw Error('Storage unavailable')}}, sessionStorage:{getItem:key=>session.get(key),setItem:(key,value)=>session.set(key,value)},
    matchMedia:()=>({matches:reduced}),setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>fn() }
  const source = readFileSync(require.resolve('../app.js'),'utf8'); const boundary = source.indexOf('  const questDone =')
  vm.runInNewContext(source.slice(0,boundary)+'globalThis.qa={playLaunch,closeLaunch,storeWelcomeName,state};})()',scope)
  scope.qa.state.profile.name = name
  const run = ms => { for (const [id,timer] of [...timers]) if(timer.ms===ms){timers.delete(id);timer.fn()} }
  return {api:scope.qa,node,timers,run,document}
}

test('Normal opening ends automatically and does not change financial data', () => {
  const {api,node,run,timers}=opening(); const before=JSON.stringify(api.state)
  api.playLaunch(); assert.equal(node('#appShell').inert,true); assert.ok([...timers.values()].some(t=>t.ms===4200))
  run(4200); run(520); assert.equal(node('#launchScreen').hidden,true); assert.equal(node('#appShell').inert,false)
  assert.equal(JSON.stringify(api.state),before)
  api.playLaunch(); assert.equal(node('#launchScreen').hidden,true)
})
test('Replay waits for user entry, then restores keyboard focus and cancels pending timers', () => {
  const {api,node,timers,document,run}=opening()
  api.playLaunch(true); assert.equal(timers.size,0); assert.equal(document.activeElement,node('#enterLaunch'))
  api.closeLaunch(); assert.equal(document.activeElement,node('#replayLaunch')); assert.equal(node('#launchScreen').inert,true)
  run(520); assert.equal(node('#launchScreen').hidden,true)
})
test('Reduced motion skips automatic intro but allows a static replay', () => {
  const {api,node,timers}=opening(true)
  api.playLaunch(); assert.equal(node('#launchScreen').hidden,true); assert.equal(timers.size,0)
  api.playLaunch(true); assert.equal(node('#launchScreen').hidden,false); assert.equal(timers.size,0)
})
test('An unnamed profile sees the name form before the personalized intro, even after a seen intro', () => {
  const {api,node,timers,document}=opening(false,'')
  api.closeLaunch(true); api.playLaunch()
  assert.equal(node('#welcomeNameForm').hidden,false); assert.equal(node('#launchTitle').hidden,true)
  assert.equal(document.activeElement,node('#welcomeName')); assert.equal(timers.size,0)
})
test('Name entry starts background motion immediately, exposes pause, and never times out', () => {
  const {api,node,timers}=opening(false,'')
  api.playLaunch()
  assert.equal(node('#launchScreen').classList.contains('playing'),true)
  assert.equal(node('#pauseLaunch').hidden,false)
  assert.equal(node('#welcomeNameForm').hidden,false)
  assert.equal(timers.size,0)
  const calm=opening(true,''); calm.api.playLaunch()
  assert.equal(calm.node('#launchScreen').classList.contains('launch-calm'),true)
  assert.equal(calm.node('#pauseLaunch').hidden,true)
})
test('A saved nickname personalizes the next animated opening without changing budget records', () => {
  const {api,node,timers,document,run}=opening(false,'')
  const before=JSON.stringify({...api.state,profile:{...api.state.profile,name:'Alex'}})
  api.playLaunch(); assert.equal(api.storeWelcomeName('  Alex  '),''); api.playLaunch(false,true)
  assert.equal(JSON.stringify(api.state),before); assert.equal(node('#welcomeNameForm').hidden,true)
  assert.match(node('#launchGreeting').textContent,/Welcome, Alex/)
  assert.ok([...timers.values()].some(t=>t.ms===4200)); run(4200)
  assert.equal(document.activeElement,node('#replayLaunch'))
})
test('Blank or overlong names cannot replace a saved name', () => {
  const {api}=opening()
  for(const invalid of ['   ','A'.repeat(33)])assert.ok(api.storeWelcomeName(invalid))
  assert.equal(api.state.profile.name,'Alex')
})
test('Storage failure preserves the previous name and returns an actionable error', () => {
  const {api}=opening(false,'',true)
  assert.match(api.storeWelcomeName('Alex'),/could not be saved/); assert.equal(api.state.profile.name,'')
})
test('Reduced motion still asks for a name, then enters without decorative motion', () => {
  const {api,node,timers}=opening(true,'')
  api.playLaunch(); assert.equal(node('#welcomeNameForm').hidden,false)
  api.storeWelcomeName('Sam'); api.playLaunch(false,true)
  assert.equal(node('#launchScreen').hidden,true); assert.equal(timers.size,0)
})
