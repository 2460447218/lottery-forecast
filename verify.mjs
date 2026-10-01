import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runBacktest,validateConfig,scoreDraw,grade,predict,choose,selectNumbers,numberStats} from './src/engine.mjs';
import {backtestOptions,prizeOptions,chartRows} from './src/echarts-options.mjs';
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
 const rows=chartRows(recent.records,mode),option=backtestOptions(recent.records,mode,false);
 assert.equal(rows.length,mode==='recent'?30:1000);
 assert.deepEqual(option.xAxis.data,rows.map(row=>row.issue));
 assert.equal(option.animation,false);
 assert.equal(option.dataZoom.length,2);
 if(mode==='cumulative'){
  assert.deepEqual(option.series[0].data,rows.map(row=>row.cumulativeCost));
  assert.deepEqual(option.series[1].data,rows.map(row=>row.cumulativePrize));
 }else{
  assert.deepEqual(option.series[0].data.map(item=>item.value),rows.map(row=>row.net));
  assert.equal(option.series[0].data[0].itemStyle.color,rows[0].net>=0?'#128a80':'#d35d63');
 }
 assert.ok(option.tooltip.formatter([{dataIndex:0}]).includes(rows[0].issue));
}
assert.deepEqual(prizeOptions(recent.counts).series[0].data,recent.counts.slice(1));
assert.equal(chartRows(recent.records.slice(0,1),'recent').length,1);
assert.throws(()=>chartRows([],'recent'));
assert.ok(backtestOptions([{...recent.records[0],unknown:1}]).tooltip.formatter([{dataIndex:0}]).includes('下限'));
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

// Birthday combinations remain valid across full pools, leap days and duplicate inputs.
const {birthdayPick, predictBirthdays} = await import('./src/birthday.mjs');
const birthdays = ['1965-02-28', '2000-02-29', '1994-12-31'];
const birthdayConfig = {type:'pool', redCount:6, blueCount:2};
const birthdayResult = predictBirthdays(draws,birthdayConfig,birthdays);
assert.equal(birthdayResult.birthday,true);
assert.equal(birthdayResult.config.strategy,'manual');
assert.equal(birthdayResult.pick.red.length,6);
assert.equal(new Set(birthdayResult.pick.red).size,6);
assert.deepEqual(birthdayPick(birthdays,birthdayConfig),birthdayPick([...birthdays].reverse(),birthdayConfig));
assert.deepEqual(birthdayPick(birthdays,birthdayConfig),birthdayPick([...birthdays,birthdays[0]],birthdayConfig));
const fullBirthday = birthdayPick(birthdays,{type:'pool',redCount:33,blueCount:16});
assert.deepEqual(fullBirthday.red,Array.from({length:33},(_,i)=>i+1));
assert.deepEqual(fullBirthday.blue,Array.from({length:16},(_,i)=>i+1));
const birthdayDan = predictBirthdays(draws,{type:'dan',danCount:4,tuoCount:5,blueCount:2},birthdays);
assert.equal(birthdayDan.pick.dan.length,4);
assert.equal(birthdayDan.pick.tuo.length,5);
assert.ok(!birthdayDan.pick.dan.some(n=>birthdayDan.pick.tuo.includes(n)));
for (const dates of [[],[''],['2001-02-29'],['2000-13-01'],['2999-01-01']]) assert.throws(()=>predictBirthdays(draws,birthdayConfig,dates));
console.log('PASS: birthday combinations, validation, duplicate dates, full pools and fixed-number backtest config.');

const {predictBirthdayMix} = await import('./src/birthday.mjs');
const family = [{name:'妈妈',date:'1965-05-12'}, {name:'爸爸',date:'1964-05-20'}, {name:'我',date:'1994-05-31'}];
const mixedOptions = {birthdayRedCount:3,round:0,seed:12345};
const familyMix = predictBirthdayMix(draws,birthdayConfig,family,mixedOptions);
assert.equal(familyMix.participating.length,3);
assert.equal(familyMix.waiting.length,0);
assert.equal(familyMix.birthdayRedCount,3);
assert.equal(familyMix.randomRedCount,3);
assert.equal(familyMix.pick.red.length,6);
assert.equal(new Set(familyMix.pick.red).size,6);
assert.equal(Object.values(familyMix.sources.red).filter(s=>s.kind==='birthday').length,3);
assert.equal(Object.values(familyMix.sources.blue).filter(s=>s.kind==='birthday').length,1);
assert.deepEqual(familyMix.pick,predictBirthdayMix(draws,birthdayConfig,family,mixedOptions).pick);
const nextMixed = predictBirthdayMix(draws,birthdayConfig,family,{...mixedOptions,seed:87654,round:1});
assert.deepEqual(Object.entries(familyMix.sources.red).filter(([,s])=>s.kind==='birthday'),Object.entries(nextMixed.sources.red).filter(([,s])=>s.kind==='birthday'));
assert.notDeepEqual(familyMix.pick.red,nextMixed.pick.red);
const rotation = new Set();
for(let round=0;round<3;round++) {
 const r=predictBirthdayMix(draws,birthdayConfig,family,{birthdayRedCount:1,round,seed:1});
 assert.equal(r.participating.length,1); assert.equal(r.waiting.length,2); rotation.add(r.participating[0]);
}
assert.equal(rotation.size,3);
const twins = predictBirthdayMix(draws,birthdayConfig,[family[0],{...family[0],name:'阿姨'}],mixedOptions);
assert.equal(twins.participating.length,1);
assert.ok(twins.participating[0].includes('妈妈 / 阿姨'));
const mixedDan = predictBirthdayMix(draws,{type:'dan',danCount:4,tuoCount:5,blueCount:2},family,mixedOptions);
assert.equal(mixedDan.pick.dan.length,4);assert.equal(mixedDan.pick.tuo.length,5);
assert.ok(!mixedDan.pick.dan.some(n=>mixedDan.pick.tuo.includes(n)));
const fixedMixed=runBacktest(draws,{...mixedDan.config,end:baselineEnd,periods:10});
assert.equal(fixedMixed.records.length,10);
const fullMixed=predictBirthdayMix(draws,{type:'pool',redCount:33,blueCount:16},family,{...mixedOptions,birthdayRedCount:33});
assert.deepEqual(fullMixed.pick.red,Array.from({length:33},(_,i)=>i+1));
assert.deepEqual(fullMixed.pick.blue,Array.from({length:16},(_,i)=>i+1));
assert.ok(fullMixed.birthdayRedCount < 33);
for(const r of [familyMix,nextMixed,mixedDan,fullMixed]) {
 for(const n of [...r.pick.red,...r.pick.dan,...r.pick.tuo]) assert.ok(r.sources.red[n]?.text);
 for(const n of r.pick.blue) assert.ok(r.sources.blue[n]?.text);
}
for(const quota of [0,7,1.5,NaN]) assert.throws(()=>predictBirthdayMix(draws,birthdayConfig,family,{...mixedOptions,birthdayRedCount:quota}));
assert.throws(()=>predictBirthdayMix(draws,birthdayConfig,[{date:'2001-02-29'}],mixedOptions));
const tracedClassic=predictBirthdays(draws,birthdayConfig,['1994-12-31']);
assert.ok(tracedClassic.sources.blue[15].text.includes('31 → 15'));
assert.ok(tracedClassic.sources.red[31].text.includes('日期：31'));
console.log('PASS: birthday provenance, family allocation, rotation, duplicate birthdays, random fill, dan and manual backtest.');
