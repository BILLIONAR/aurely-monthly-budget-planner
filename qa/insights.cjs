const {readFileSync}=require('node:fs')
const vm=require('node:vm')
const {test}=require('node:test')
const assert=require('node:assert/strict')
function api(){
 const source=readFileSync(require.resolve('../app.js'),'utf8'); const end=source.indexOf('  const financeUI = createFinanceUI(')
 const scope={BudgetFinance:require('../finance.js'),Intl,Date,console,localStorage:{getItem:()=>null},document:{querySelector:()=>({}),querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},setTimeout(){},setInterval(){},matchMedia:()=>({matches:true})}
 vm.runInNewContext(source.slice(0,end)+'globalThis.qa={set state(s){state=mergeState(s)},blankState,insightSnapshot,insightRows,remaining,sixMonthActivity};})()',scope)
 return scope.qa
}
test('Visual overview reconciles with the plan without counting reservations or charges twice',()=>{
 const a=api(),s=a.blankState(); s.paydays=[{id:'p',date:'2026-09-01',amount:1800}]
 s.bills=[{id:'b',due:1,amount:900,name:'Rent',paidMonths:{}}];s.expenses=[{id:'e',date:'2026-09-02',amount:200,category:'Groceries'}]
 s.goals=[{id:'g',saved:0,keepOut:true,contributions:[{id:'c',date:'2026-09-02',type:'deposit',amount:100}]}]
 s.debts=[{id:'d',openingBalance:500,history:[{id:'x',date:'2026-09-02',type:'charge',amount:300},{id:'y',date:'2026-09-02',type:'payment',amount:150}]}]
 s.paycheckPlans={p:{debt:500,savings:300,other:200}};a.state=s
 const v=a.insightSnapshot('2026-09');assert.equal(v.used,1350);assert.equal(v.left,450);assert.equal(v.left,a.remaining('2026-09'));assert.equal(v.days[1].amount,200);assert.equal(a.insightRows('2026-09','debt').length,1)
})
test('Net savings returns are income-side adjustments, never negative donut segments',()=>{
 const a=api(),s=a.blankState();s.goals=[{id:'g',saved:500,keepOut:true,contributions:[{id:'r',date:'2026-09-02',type:'return',amount:100}]}];a.state=s
 const v=a.insightSnapshot('2026-09');assert.equal(v.returned,100);assert.equal(v.left,100);assert.equal(v.used,0);assert.equal(v.total,100);assert.equal(a.insightRows('2026-09','savings')[0].amount,-100)
})
test('Empty, over-plan and leap-year views remain truthful',()=>{
 const a=api(),s=a.blankState();a.state=s;assert.equal(a.insightSnapshot('2028-02').days.length,29);assert.equal(a.insightSnapshot('2026-09').total,0)
 s.expenses=[{id:'e',date:'2026-09-10',amount:23.45,category:'Other'},{id:'f',date:'2026-10-01',amount:99,category:'Other'}];a.state=s
 const v=a.insightSnapshot('2026-09');assert.equal(v.left,-23.45);assert.equal(v.total,23.45);s.expenses=[];a.state=s;assert.equal(a.insightSnapshot('2026-09').used,0)
})
test('Today is the first navigation item, followed by Planner',()=>{
 const html=readFileSync(require.resolve('../index.html'),'utf8');assert.ok(html.indexOf('data-view="today"')<html.indexOf('data-view="month"'));assert.ok(html.includes('id="todayInsights"'))
})
test('Six-month chart crosses years and excludes forecast income',()=>{
 const a=api(),s=a.blankState();s.paydays=[{id:'p',date:'2025-12-31',amount:10.20}];s.moneyIn=[{id:'m',date:'2026-01-01',amount:5.30}];s.expenses=[{id:'e',date:'2025-12-31',amount:2.15,category:'Other'}];a.state=s
 const rows=a.sixMonthActivity('2026-02');assert.equal(rows[0].month,'2025-09');assert.equal(rows[5].month,'2026-02');assert.equal(rows[3].income,10.2);assert.equal(rows[3].spending,2.15);assert.equal(rows[4].income,5.3);assert.equal(rows[5].income,0)
})
test('Retired XP cannot return through defaults or saved-state normalization',()=>{
 const a=api();assert.ok(!('game' in a.blankState()))
 const source=readFileSync(require.resolve('../app.js'),'utf8');const html=readFileSync(require.resolve('../index.html'),'utf8')
 assert.ok(source.includes('delete merged.game'));assert.ok(!source.includes('state.game'));assert.ok(!html.includes('id="levelBadge"'));assert.ok(!html.includes('id="xpBar"'))
})
