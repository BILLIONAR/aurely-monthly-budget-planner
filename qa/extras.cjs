const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../budget-extras.js')
test('Payoff estimate handles zero APR, final partial payment and year rollover',()=>{
 assert.deepEqual(E.payoffEstimate(250,0,100,'2026-11-30'),{status:'estimated',months:3,interest:0,month:'2027-02'})
 assert.equal(E.payoffEstimate(100,12,101,'2026-09-09').interest,1)
 assert.equal(E.payoffEstimate(100,12,101,'2026-09-09').months,1)
 const e=E.payoffEstimate(980,19.9,75,'2026-09-09');assert.equal(e.months,15);assert(e.interest>0)
})
test('Payoff estimate never invents a date for non-amortizing or absent payments',()=>{
 assert.equal(E.payoffEstimate(100,12,1,'2026-09-09').status,'insufficient')
 assert.equal(E.payoffEstimate(100,0,0,'2026-09-09').status,'no-payment')
 assert.equal(E.payoffEstimate(0,12,0,'2026-09-09').status,'paid')
 assert.equal(E.payoffEstimate(10000,0,.01,'2026-09-09').status,'long-term')
 for(const input of [[-1,0,1],[1,-1,1],[Infinity,0,1],[1,0,NaN]])assert.equal(E.payoffEstimate(...input,'2026-09-09').status,'invalid')
 assert.equal(E.payoffEstimate(1,0,1,'2026-02-30').status,'invalid')
})
test('Comparison sums caps per category, distinguishes zero and absent caps, filters exact months',()=>{
 const s={envelopes:[{category:'Home',cap:25},{category:'Home',cap:50},{category:'Fun',cap:0}],expenses:[{category:'Home',date:'2026-09-03',amount:80},{category:'Other',date:'2026-09-04',amount:10},{category:'Home',date:'2025-09-03',amount:900}]},before=JSON.stringify(s)
 const r=E.categoryComparison(s,'2026-09');assert.deepEqual(r.find(r=>r.name==='Home'),{name:'Home',planned:75,actual:80});assert.equal(r.find(r=>r.name==='Fun').planned,0);assert.equal(r.find(r=>r.name==='Other').planned,null);assert.equal(JSON.stringify(s),before)
})
test('Ledger uses original IDs, keeps income types distinct and excludes forecast, bills and transfers',()=>{
 const s={paydays:[{id:'same',date:'2026-09-10',amount:100}],moneyIn:[{id:'same',date:'2026-09-09',amount:50,name:'Gift'}],expenses:[{id:'e',date:'2025-09-09',amount:20,category:'Home',note:'Lamp'}],bills:[{amount:999}],goals:[{contributions:[{amount:888}]}],profile:{usualPaycheck:5000}}
 assert.equal(E.combinedLedger(s).length,3);assert.equal(E.combinedLedger(s,'2026-09','income').length,2);assert.equal(E.combinedLedger(s,'','','lamp')[0].id,'e');assert.equal(E.combinedLedger(s,'2026-09','','gift')[0].kind,'extra')
})
test('Preset validation supports an intentionally empty list and rejects corrupt backups',()=>{
 assert.deepEqual(E.validatePresets([]),[]);E.validatePresets(E.defaults)
 for(const rows of [[E.defaults[0],E.defaults[0]],[{...E.defaults[0],amount:-1}],[{...E.defaults[0],amount:1.001}],[{...E.defaults[0],category:'<script>'}],{},Array(13).fill(E.defaults[0])])assert.throws(()=>E.validatePresets(rows))
 assert(E.validDate('2028-02-29'));assert(!E.validDate('2026-02-29'))
})
