import {choose,validateConfig,selectNumbers,scoreDraw} from './engine.mjs';

export function validateMultiConfig(input,n){
 const config=validateConfig({...input,type:'pool',redCount:input.redPool,blueCount:input.bluePool},n);
 const tickets=Number(input.tickets);
 if(!Number.isInteger(tickets)||tickets<1||tickets>100)throw new Error('每期请选择1—100注。');
 if(choose(config.redCount,6)<tickets)throw new Error(`红球候选池只有${choose(config.redCount,6)}组不同的6红组合，不能生成${tickets}注不同红球。请扩大红球池。`);
 const maxOverlap=Number(input.maxOverlap??5),blueMode=input.blueMode??'random';
 if(![2,3,4,5].includes(maxOverlap)||!['random','balanced'].includes(blueMode))throw new Error('请选择有效的红球重复上限和蓝球分配方式。');
 const q=Math.floor(tickets*6/config.redCount),rem=tickets*6%config.redCount;
 if(tickets>1&&(12-config.redCount>maxOverlap||config.redCount*q*(q-1)/2+rem*q>tickets*(tickets-1)/2*maxOverlap||tickets*choose(6,maxOverlap+1)>choose(config.redCount,maxOverlap+1)))throw new Error('当前红球池无法满足注数和重复上限，请扩大红球池、减少注数或放宽重复上限。');
 return {...config,redPool:config.redCount,bluePool:config.blueCount,tickets,maxOverlap,blueMode};
}
function rng(seed){let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
export function multiPicks(data,t,input){
 const candidates=selectNumbers(data,t,input),random=rng((input.seed^Math.imul(t+1,2654435761))>>>0),seen=new Set(),tickets=[];
 const append=red=>{red.sort((a,b)=>a-b);const key=red.join(',');if(seen.has(key)||tickets.some(ticket=>ticket.red.filter(n=>red.includes(n)).length>(input.maxOverlap??5)))return;seen.add(key);let bluePool=candidates.blue;if(input.blueMode==='balanced'){const counts=candidates.blue.map(n=>tickets.filter(ticket=>ticket.blue[0]===n).length),minimum=Math.min(...counts);bluePool=candidates.blue.filter((_,i)=>counts[i]===minimum);}tickets.push({red,blue:[bluePool[Math.floor(random()*bluePool.length)]],dan:[],tuo:[]});};
 for(let attempt=0;tickets.length<input.tickets&&attempt<10000;attempt++){
  if((input.maxOverlap??5)<5&&attempt>0&&attempt%1000===0){tickets.length=0;seen.clear();}
  const red=[...candidates.red];for(let i=red.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[red[i],red[j]]=[red[j],red[i]];}append(red.slice(0,6));
 }
 // A small nearly exhausted pool can collide repeatedly; finish by enumerating unused combinations.
 function fill(offset,prefix){if(tickets.length>=input.tickets)return;if(prefix.length===6){append([...prefix]);return;}for(let i=offset;i<=candidates.red.length-(6-prefix.length);i++){fill(i+1,[...prefix,candidates.red[i]]);if(tickets.length>=input.tickets)return;}}
 if(tickets.length<input.tickets&&(input.maxOverlap??5)===5)fill(0,[]);
 if(tickets.length<input.tickets)throw new Error('在限定搜索次数内未找到满足分散条件的整组号码；请扩大红球池、减少注数或放宽重复上限。');
 return {redPool:candidates.red,bluePool:candidates.blue,tickets};
}
export function runMultiBacktest(data,input,progress=()=>{},withRecords=true){
 const config=validateMultiConfig(input,data.length),costPerPeriod=config.tickets*2,records=[],counts=new Array(8).fill(0);
 let prize=0,unknown=0,winningPeriods=0,profitablePeriods=0,noWinRun=0,longestNoWin=0;
 for(let t=config.end-config.periods;t<config.end;t++){
  const selected=multiPicks(data,t,config),ticketRows=selected.tickets.map(pick=>({pick,...scoreDraw(data[t],pick,{type:'pool'})}));
  const payout=ticketRows.reduce((s,row)=>s+row.payout,0),missing=ticketRows.reduce((s,row)=>s+row.unknown,0),won=ticketRows.some(row=>row.counts.slice(1).some(Boolean));
  prize+=payout;unknown+=missing;winningPeriods+=Number(won);profitablePeriods+=Number(payout>costPerPeriod);ticketRows.forEach(row=>row.counts.forEach((v,i)=>counts[i]+=v));
  noWinRun=won?0:noWinRun+1;longestNoWin=Math.max(longestNoWin,noWinRun);
  if(withRecords)records.push({issue:data[t].issue,date:data[t].date,actualRed:data[t].red,actualBlue:data[t].blue,...selected,tickets:ticketRows,payout,unknown:missing,cost:costPerPeriod,net:payout-costPerPeriod,cumulativeCost:costPerPeriod*(t-(config.end-config.periods)+1),cumulativePrize:prize});
  if(t%100===0)progress((t-(config.end-config.periods))/config.periods);
 }
 const cost=costPerPeriod*config.periods;
 return {config,costPerPeriod,periods:config.periods,cost,prize,net:prize-cost,unknown,winningPeriods,profitablePeriods,longestNoWin,counts,winRate:winningPeriods/config.periods,returnRate:prize/cost,records,startIssue:data[config.end-config.periods].issue,endIssue:data[config.end-1].issue,next:multiPicks(data,config.end,config)};
}
export function runMultiExperiment(data,input,progress=()=>{}){
 const selected=runMultiBacktest(data,input,p=>progress({stage:'回测所选规则',progress:p*.1}));
 const samples=[],ordinary=[];
 for(let i=0;i<100;i++){
  const seed=(selected.config.seed+i*7919)>>>0||1;
  const r=i===0?selected:runMultiBacktest(data,{...selected.config,seed},()=>{},false);
  samples.push({seed,prize:r.prize,net:r.net,returnRate:r.returnRate,winRate:r.winRate,longestNoWin:r.longestNoWin,unknown:r.unknown});
  ordinary.push(selected.config.maxOverlap===5&&selected.config.blueMode==='random'?r:runMultiBacktest(data,{...selected.config,seed,maxOverlap:5,blueMode:'random'},()=>{},false));
  progress({stage:'同一方法测试100个随机编号',progress:.1+(i+1)/100*.5});
 }
 const sorted=[...samples].sort((a,b)=>a.returnRate-b.returnRate||a.seed-b.seed),runs=samples.map(r=>r.longestNoWin).sort((a,b)=>a-b);
 const stability={samples,meanReturn:samples.reduce((s,r)=>s+r.returnRate,0)/100,medianReturn:(sorted[49].returnRate+sorted[50].returnRate)/2,worst:sorted[0],best:sorted[99],lossRate:samples.filter(r=>r.net<0).length/100,longestNoWin:Math.max(...runs),medianNoWin:(runs[49]+runs[50])/2,unknownSamples:samples.filter(r=>r.unknown>0).length};
 const ordinaryRuns=ordinary.map(r=>r.longestNoWin).sort((a,b)=>a-b),ordinaryRates=ordinary.map(r=>r.returnRate).sort((a,b)=>a-b);
 stability.meanWin=samples.reduce((s,r)=>s+r.winRate,0)/100;
 stability.ordinary={meanReturn:ordinary.reduce((s,r)=>s+r.returnRate,0)/100,medianReturn:(ordinaryRates[49]+ordinaryRates[50])/2,meanWin:ordinary.reduce((s,r)=>s+r.winRate,0)/100,lossRate:ordinary.filter(r=>r.net<0).length/100,medianNoWin:(ordinaryRuns[49]+ordinaryRuns[50])/2,unknownSamples:ordinary.filter(r=>r.unknown>0).length};
 const baselines=[];
 for(let i=0;i<100;i++){
  baselines.push(runMultiBacktest(data,{...selected.config,strategy:'random',redPool:33,bluePool:16,maxOverlap:5,blueMode:'random',seed:(selected.config.seed+i*7919)>>>0||1},()=>{},false));
  progress({stage:'比较100组同注数随机选号',progress:.6+(i+1)/100*.4});
 }
 const rates=baselines.map(r=>r.returnRate).sort((a,b)=>a-b);
 return {...selected,version:2,stability,random:{samples:100,meanReturn:baselines.reduce((s,r)=>s+r.returnRate,0)/100,medianReturn:(rates[49]+rates[50])/2,meanWin:baselines.reduce((s,r)=>s+r.winRate,0)/100,low:rates[2],high:rates[97],percentile:baselines.filter(r=>r.returnRate<selected.returnRate).length/100}};
}
