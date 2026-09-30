import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runBacktest,validateConfig,scoreDraw,grade,predict,choose,selectNumbers,numberStats} from './src/engine.mjs';
import {chartModel,chartSvg,chartSelection,chartIndexAt} from './src/chart.mjs';
import {normalizeDraw,mergeDraws} from './scripts/update-draws.mjs';
const draws=JSON.parse(fs.readFileSync(new URL('./public/draws.json',import.meta.url),'utf8'));
const baselineEnd=draws.findIndex(r=>r.issue==='26113')+1;
assert.equal(baselineEnd,3510);
const baselineDraws=draws.slice(0,baselineEnd);
const base={strategy:'hot100',type:'pool',redCount:6,blueCount:2,seed:20260930,periods:3010,end:baselineEnd};
for(const [redCount,blueCount,hot,blend] of [[6,2,3450,3325],[7,1,18365,12980],[7,2,29690,23680],[6,16,23475,23760]]){
 for(const [strategy,total] of [['hot100',hot],['blend',blend]]){
  const r=runBacktest(draws,{...base,redCount,blueCount,strategy});assert.equal(r.prize,total);assert.equal(r.cost,choose(redCount,6)*blueCount*2*3010);assert.equal(r.unknown,0);assert.equal(r.counts.reduce((a,b)=>a+b,0),r.tickets*3010);
 }
}
const dan=runBacktest(draws,{...base,type:'dan',danCount:4,tuoCount:7,blueCount:1});assert.equal(dan.prize,5070110);assert.equal(dan.counts[1],1);assert.equal(dan.records.find(r=>r.counts[1]).issue,'07016');
const recent=runBacktest(draws,{...base,periods:1000});assert.equal(recent.prize,1255);assert.equal(recent.winningPeriods,140);
for(const mode of ['cumulative','recent']){
 const model=chartModel(recent.records,mode),markup=chartSvg(model);
 assert.equal(model.end,999);assert.equal(model.start,mode==='recent'?970:0);
 assert.equal(chartIndexAt(model,72),model.start);assert.equal(chartIndexAt(model,780),model.end);
 assert.ok(markup.includes('chart-selection'));assert.ok(chartSelection(model,model.start).includes('circle'));
}
const next=predict(baselineDraws,base);assert.deepEqual(next.pick.red,[13,14,22,24,25,30]);assert.deepEqual(next.pick.blue,[2,4]);
const missingDraws=structuredClone(baselineDraws);missingDraws.at(-1).first=0;missingDraws.at(-1).second=0;
const manual={red:missingDraws.at(-1).red,blue:[missingDraws.at(-1).blue]};const missing=runBacktest(missingDraws,{...base,strategy:'manual',manual,blueCount:1,periods:1});assert.equal(missing.counts[1],1);assert.equal(missing.unknown,1);assert.equal(missing.prize,0);
const officialLatest={code:'2026113',date:'2026-09-29(二)',red:'03,04,20,24,29,30',blue:'11',fyjMoney:'',prizegrades:[{type:1,typemoney:'6845689'},{type:2,typemoney:'139824'}]};
assert.deepEqual(normalizeDraw(officialLatest),baselineDraws.at(-1));
const future={...officialLatest,code:'2026114',date:'2026-10-01(四)',red:'01,02,03,04,05,06',blue:'07'};
const merged=mergeDraws(baselineDraws,[future,officialLatest]);assert.equal(merged.added,1);assert.equal(merged.draws.at(-1).issue,'26114');
assert.throws(()=>mergeDraws(baselineDraws,[{...officialLatest,blue:'12'}]));
assert.throws(()=>validateConfig({...base,periods:3011},draws.length));assert.throws(()=>validateConfig({...base,blueCount:0},draws.length));assert.throws(()=>validateConfig({...base,strategy:'manual',manual:{red:[1,1,2,3,4,5],blue:[1,2]}},draws.length));assert.throws(()=>validateConfig({...base,type:'dan',danCount:4,tuoCount:2},draws.length));
function combinations(a,k){if(k===0)return [[]];return a.flatMap((v,i)=>combinations(a.slice(i+1),k-1).map(t=>[v,...t]));}
for(let t=500;t<800;t+=17){const pick={red:[],dan:[1,4,12],tuo:[8,10,15,18,21,26,31],blue:[2,8,15]};const c={type:'dan'};let count=new Array(8).fill(0);for(const red of combinations(pick.tuo,3))for(const blue of pick.blue){const hits=[...pick.dan,...red].filter(v=>draws[t].red.includes(v)).length;count[grade(hits,blue===draws[t].blue,draws[t].special)]++;}assert.deepEqual(scoreDraw(draws[t],pick,c).counts,count);}
const fixed={...base,strategy:'random',periods:100};assert.deepEqual(runBacktest(draws,fixed).counts,runBacktest(draws,fixed).counts);
const stats=numberStats(draws,1500),hot=[...stats.red].sort((a,b)=>b.last100-a.last100||a.number-b.number).map(x=>x.number);
for(const strategy of ['hotcold','oddeven','zones']){
 const config={...base,strategy,redCount:6,blueCount:2,periods:20,end:1500},pick=selectNumbers(draws,1499,config),test=runBacktest(draws,config);
 assert.equal(new Set(pick.red).size,6);assert.equal(new Set(pick.blue).size,2);assert.equal(test.records.length,20);assert.equal(test.counts.reduce((a,b)=>a+b,0),test.tickets*20);
 const changed=structuredClone(draws);changed[1499].red=[1,2,3,4,5,6];changed[1499].blue=1;assert.deepEqual(selectNumbers(changed,1499,config),pick);
}
const mixed=selectNumbers(draws,1500,{...base,strategy:'hotcold'}).red;assert.deepEqual(mixed,[hot[0],hot.at(-1),hot[1],hot.at(-2),hot[2],hot.at(-3)].sort((a,b)=>a-b));
const parity=selectNumbers(draws,1500,{...base,strategy:'oddeven'}).red;assert.equal(parity.filter(v=>v%2).length,3);
const zones=selectNumbers(draws,1500,{...base,strategy:'zones'}).red;assert.deepEqual([zones.filter(v=>v<=11).length,zones.filter(v=>v>=12&&v<=22).length,zones.filter(v=>v>=23).length],[2,2,2]);
// Cutoff excludes the target and all later draws: changing them cannot change an earlier pick.
const end=1700,r1=runBacktest(draws,{...base,end,periods:2});const altered=structuredClone(draws);altered[end-1].red=[1,2,3,4,5,6];altered[end-1].blue=1;assert.deepEqual(runBacktest(altered,{...base,end,periods:2}).records.at(-1).pick,r1.records.at(-1).pick);
console.log('PASS: existing baselines and scoring, three new selection methods, balanced picks, and no-lookahead checks.');
