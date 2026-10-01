import {scoreDraw,selectNumbers,choose} from './engine.mjs';

export const FEATURES=['短期热度','窗口热度','冷号反向','遗漏长度','上期转移','号码共现','间隔回声'];
const WINDOWS=[30,100,300], SEED=731029;
function random(seed){let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
const order=a=>Array.from({length:a.length},(_,i)=>i).sort((x,y)=>a[y]-a[x]||x-y);
function normalized(a){const sorted=order(a),r=new Array(a.length);let i=0;while(i<sorted.length){let j=i;while(j+1<sorted.length&&a[sorted[j+1]]===a[sorted[i]])j++;for(let k=i;k<=j;k++)r[sorted[k]]=1-(i+j)/2/(a.length-1);i=j+1;}return r;}
export function researchFeatures(data,t,window){
 return Object.fromEntries([['red',33],['blue',16]].map(([color,n])=>{
  const arrays=Array.from({length:7},()=>new Array(n).fill(0)),last=new Set(color==='red'?data[t-1].red:[data[t-1].blue]);
  const values=row=>color==='red'?row.red:[row.blue];
  for(let i=Math.max(0,t-window);i<t;i++){
   const numbers=values(data[i]),trigger=i>0?values(data[i-1]).filter(v=>last.has(v)).length:0,shared=numbers.filter(v=>last.has(v)).length;
   const redShared=color==='blue'?data[i].red.filter(v=>data[t-1].red.includes(v)).length:0;
   for(const v of numbers){arrays[1][v-1]++;if(i>=t-15)arrays[0][v-1]++;arrays[4][v-1]+=trigger;arrays[5][v-1]+=color==='blue'?redShared:shared-Number(last.has(v));if([7,13,21].some(lag=>(t-i)%lag===0))arrays[6][v-1]++;}
  }
  arrays[2]=arrays[1].map(v=>-v);
  arrays[3].fill(t);for(let i=t-1;i>=0;i--){for(const v of values(data[i]))if(arrays[3][v-1]===t)arrays[3][v-1]=t-1-i;if(arrays[3].every(v=>v!==t))break;}
  // Conditioned counts are divided by appearance counts to reduce the hot-number bias.
  for(const key of [4,5])arrays[key]=arrays[key].map((v,i)=>(v+1)/(arrays[1][i]+2));
  return [color,arrays.map(normalized)];
 }));
}
export function researchPick(features,weights,redCount,blueCount){
 const rank=color=>order(features[color][0].map((_,i)=>features[color].reduce((s,f,j)=>s+f[i]*weights[j],0))).map(i=>i+1);
 return {red:rank('red').slice(0,redCount).sort((a,b)=>a-b),blue:rank('blue').slice(0,blueCount).sort((a,b)=>a-b),dan:[],tuo:[]};
}
function candidates(){
 const weights=FEATURES.map((_,i)=>FEATURES.map((_,j)=>Number(i===j)));
 weights.push([2,2,0,0,2,1,1],[0,1,1,2,2,1,1],[1,1,0,1,3,2,1],[0,0,1,1,1,2,3],[1,2,0,0,0,0,0]);
 const rng=random(SEED);while(weights.length<80){const w=FEATURES.map(()=>rng()<.4?0:1+Math.floor(rng()*4));if(w.some(Boolean)&&!weights.some(old=>old.join()===w.join()))weights.push(w);}
 return WINDOWS.flatMap(window=>weights.map((weights,i)=>({id:`W${window}-${String(i+1).padStart(2,'0')}`,window,weights})));
}
function summarize(records,cost){const prize=records.reduce((s,r)=>s+r.payout,0),wins=records.filter(r=>r.won).length;return{periods:records.length,wins,winRate:wins/records.length,cost:cost*records.length,prize,net:prize-cost*records.length,returnRate:prize/(cost*records.length),unknown:records.reduce((s,r)=>s+r.unknown,0),redHits:records.reduce((s,r)=>s+r.redHits,0)/records.length,blueHits:records.reduce((s,r)=>s+r.blueHit,0)};}
const evaluate=(draw,pick,config)=>{const s=scoreDraw(draw,pick,config);return{payout:s.payout,unknown:s.unknown,redHits:s.redHits,blueHit:s.blueHit,won:s.counts.slice(1).some(Boolean)};};
export function runResearch(data,{redCount=6,blueCount=2,end=data.length,objective='returnRate'}={},progress=()=>{}){
 if(!Number.isInteger(end)||end<1000||end>data.length)throw new Error('规律研究需要至少1000期历史数据。');
 if(!Number.isInteger(redCount)||redCount<6||redCount>8||!Number.isInteger(blueCount)||blueCount<1||blueCount>4)throw new Error('研究范围为6—8红、1—4蓝。');
 if(!['returnRate','winRate'].includes(objective))throw new Error('请选择有效的研究目标。');
 const config={type:'pool',redCount,blueCount},cost=choose(redCount,6)*blueCount*2,start=500,count=end-start,trainingEnd=start+Math.floor(count*.6),validationEnd=start+Math.floor(count*.8);
 const cache=new Map(),models=candidates();
 for(const window of WINDOWS){const rows=[];for(let t=start;t<end;t++){rows.push(researchFeatures(data,t,window));if(t%100===0)progress({stage:'提取历史特征',progress:(WINDOWS.indexOf(window)+(t-start)/count)/3*.35});}cache.set(window,rows);}
 const compare=(a,b)=>b[objective]-a[objective]||(objective==='returnRate'?b.winRate-a.winRate:b.returnRate-a.returnRate);
 const evaluated=models.map((model,index)=>{
  const records=[];for(let t=start;t<validationEnd;t++)records.push(evaluate(data[t],researchPick(cache.get(model.window)[t-start],model.weights,redCount,blueCount),config));
  progress({stage:'搜索240套候选模型',progress:.35+(index+1)/models.length*.35});
  return {...model,training:summarize(records.slice(0,trainingEnd-start),cost),validation:summarize(records.slice(trainingEnd-start),cost)};
 });
 evaluated.sort((a,b)=>compare(a.training,b.training)||a.id.localeCompare(b.id));
 const shortlist=evaluated.slice(0,10).sort((a,b)=>compare(a.validation,b.validation)||a.id.localeCompare(b.id));
 const selected=shortlist[0],testRecords=[];
 for(let t=validationEnd;t<end;t++){const pick=researchPick(cache.get(selected.window)[t-start],selected.weights,redCount,blueCount);testRecords.push({issue:data[t].issue,date:data[t].date,pick,...evaluate(data[t],pick,config)});}
 const test=summarize(testRecords,cost),baselines=[];
 for(let sample=0;sample<200;sample++){
  const rows=[];for(let t=validationEnd;t<end;t++)rows.push(evaluate(data[t],selectNumbers(data,t,{...config,strategy:'random',seed:SEED+sample*7919}),config));
  baselines.push(summarize(rows,cost));if(sample%10===0)progress({stage:'对照200组同成本随机策略',progress:.7+(sample+1)/200*.3});
 }
 const randomValues=baselines.map(r=>r[objective]).sort((a,b)=>a-b),upper=baselines.filter(r=>r[objective]>=test[objective]).length;
 const blocks=Array.from({length:4},(_,i)=>{const a=Math.floor(testRecords.length*i/4),b=Math.floor(testRecords.length*(i+1)/4);return{start:testRecords[a].issue,end:testRecords[b-1].issue,...summarize(testRecords.slice(a,b),cost)};});
 const weightTotal=selected.weights.reduce((a,b)=>a+b,0);
 return {version:1,seed:SEED,generatedAt:new Date().toISOString(),endIssue:data[end-1].issue,endDate:data[end-1].date,config,objective,costPerPeriod:cost,candidateCount:models.length,shortlistCount:10,selected:{...selected,weightShares:selected.weights.map(w=>w/weightTotal)},shortlist,trainingRange:[data[start].issue,data[trainingEnd-1].issue],validationRange:[data[trainingEnd].issue,data[validationEnd-1].issue],testRange:[data[validationEnd].issue,data[end-1].issue],test,blocks,testRecords,random:{samples:200,meanReturn:baselines.reduce((s,r)=>s+r.returnRate,0)/200,meanWin:baselines.reduce((s,r)=>s+r.winRate,0)/200,low:randomValues[5],high:randomValues[194],upperTail:(upper+1)/201,percentile:baselines.filter(r=>r[objective]<test[objective]).length/200},nextPick:researchPick(researchFeatures(data,end,selected.window),selected.weights,redCount,blueCount),features:FEATURES};
}
