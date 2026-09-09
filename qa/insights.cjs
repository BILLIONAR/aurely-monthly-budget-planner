const {readFileSync}=require('node:fs')
const vm=require('node:vm')
const {test}=require('node:test')
const assert=require('node:assert/strict')
function api(){
 const source=readFileSync(require.resolve('../app.js'),'utf8'); const end=source.indexOf('  const financeUI = createFinanceUI(')
 const scope={BudgetFinance:require('../finance.js'),Intl,Date,console,localStorage:{getItem:()=>null},document:{querySelector:()=>({}),querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},setTimeout(){},setInterval(){},matchMedia:()=>({matches:true})}
 vm.runInNewContext(source.slice(0,end)+'globalThis.qa={set state(s){state=mergeState(s)},blankState,insightSnapshot,insightRows,remaining,sixMonthActivity,monthStatistics,statisticsCard};})()',scope)
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
 const html=readFileSync(require.resolve('../index.html'),'utf8');assert.ok(html.indexOf('data-view="today"')<html.indexOf('data-view="month"'));assert.ok(html.includes('data-view-panel="insights"'))
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
test('Monthly statistics are dated, cent-rounded and recalculate after edits and deletes',()=>{
 const a=api(),s=a.blankState();s.expenses=[{id:'a',date:'2026-09-01',amount:10.1,category:'Food'},{id:'b',date:'2026-09-01',amount:20.2,category:'Food'},{id:'c',date:'2026-09-02',amount:9.7,category:'Travel'},{id:'d',date:'2026-10-01',amount:900,category:'Other'}];s.bills=[{id:'b',name:'Rent',amount:100,due:1,paidMonths:{'2026-09':true}},{id:'c',name:'Phone',amount:20,due:15,paidMonths:{}}];a.state=s
 const v=a.monthStatistics('2026-09');assert.equal(v.total,40);assert.equal(v.average,20);assert.equal(v.largest,20.2);assert.equal(v.count,3);assert.equal(v.loggedDays,2);assert.equal(v.categories[0].amount,30.3);assert.equal(v.bills.paid,100);assert.equal(v.bills.open,20);assert.equal(a.monthStatistics('2026-10').bills.paid,0)
 s.expenses[0].amount=20.1;s.expenses.splice(1,1);a.state=s;assert.equal(a.monthStatistics('2026-09').total,29.8)
})
test('Statistics have honest empty states, escape categories and hide all monetary chart values',()=>{
 const a=api(),s=a.blankState();a.state=s;assert.equal(a.monthStatistics('2026-09').average,0);assert.match(a.statisticsCard('2026-09'),/Add a spending entry/)
 s.expenses=[{id:'x',date:'2026-09-01',amount:123.45,category:'<img src=x onerror=alert(1)>'}];s.privateMode=true;a.state=s;const html=a.statisticsCard('2026-09');assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('123.45'));assert.match(html,/width:0%/);assert.match(html,/Hidden/)
})
test('Donut uses a square spacer and an absolute inset, not percentage-height children',()=>{
 const css=readFileSync(require.resolve('../styles.css'),'utf8');assert.match(css,/\.flow-ring::before\s*\{[^}]*padding-bottom:100%/);const inner=css.match(/\.flow-ring > div\s*\{([^}]+)\}/)[1];assert.match(inner,/position:absolute/);assert.match(inner,/inset:17px/);assert.ok(!inner.includes('height:100%'))
})
