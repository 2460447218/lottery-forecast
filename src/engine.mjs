export const TOTAL=17721088;
export const GRADES=['未中奖','一等奖','二等奖','三等奖','四等奖','五等奖','六等奖','福运奖'];
export const STRATEGIES={hot100:'近100期热号',blend:'长短期加权热号',hot30:'近30期热号',cold100:'近100期冷号',overdue:'遗漏最长',hotcold:'冷热交替',oddeven:'红球奇偶交替',zones:'红球三区轮选',random:'随机选号',manual:'手动固定号码'};
STRATEGIES.combined='多选组合';
export const COMBINABLE = Object.entries(STRATEGIES).filter(([key]) => !['manual','combined'].includes(key));
export function choose(n,k){if(k<0||n<k||n<0)return 0;k=Math.min(k,n-k);let a=1;for(let i=1;i<=k;i++)a=a*(n-i+1)/i;return Math.round(a);}
function integer(v,min,max,label){let x=Number(v);if(!Number.isInteger(x)||x<min||x>max)throw new Error(`${label}需要是 ${min}—${max} 之间的整数。`);return x;}
function numbers(v,len,max,label){if(!Array.isArray(v)||v.length!==len||new Set(v).size!==len||v.some(x=>!Number.isInteger(x)||x<1||x>max))throw new Error(`${label}请选择 ${len} 个不重复的号码（1—${max}）。`);return [...v].sort((a,b)=>a-b);}
export function validateConfig(c,n,forPrediction=false){
 if(!Object.hasOwn(STRATEGIES,c.strategy))throw new Error('请选择有效的选号规则。');
 if(!['pool','dan'].includes(c.type))throw new Error('请选择有效的投注方式。');
 const cfg={strategy:c.strategy,type:c.type,blueCount:integer(c.blueCount,1,16,'蓝球个数'),seed:integer(c.seed??20260930,1,4294967295,'随机种子')};
 if(c.strategy==='combined'){
  if(!Array.isArray(c.methods)||c.methods.length<2||new Set(c.methods).size!==c.methods.length||c.methods.some(key=>!COMBINABLE.some(([id])=>id===key)))throw new Error('组合方式请至少选择两种不同的规则。');
  cfg.methods=[...c.methods];
 }
 if(c.type==='pool')cfg.redCount=integer(c.redCount,6,33,'红球个数');
 else{cfg.danCount=integer(c.danCount,1,5,'胆码个数');cfg.tuoCount=integer(c.tuoCount,7-cfg.danCount,33-cfg.danCount,'拖码个数');}
 if(c.strategy==='manual'){
  cfg.manual={blue:numbers(c.manual?.blue,cfg.blueCount,16,'蓝球')};
  if(c.type==='pool')cfg.manual.red=numbers(c.manual?.red,cfg.redCount,33,'红球');
  else{cfg.manual.dan=numbers(c.manual?.dan,cfg.danCount,33,'胆码');cfg.manual.tuo=numbers(c.manual?.tuo,cfg.tuoCount,33,'拖码');if(cfg.manual.dan.some(v=>cfg.manual.tuo.includes(v)))throw new Error('胆码和拖码不能重复。');}
 }
 if(!forPrediction){cfg.end=integer(c.end,c.strategy==='manual'?1:501,n,'截止期');const max=cfg.end-(c.strategy==='manual'?0:500);cfg.periods=integer(c.periods,1,max,'回测期数');}
 return cfg;
}
export function betCount(c){return (c.type==='dan'?choose(c.tuoCount,6-c.danCount):choose(c.redCount,6))*c.blueCount;}
export function betLabel(c){return c.type==='dan'?`${c.danCount}胆 ${c.tuoCount}拖 + ${c.blueCount}蓝`:`${c.redCount}红 + ${c.blueCount}蓝`;}
function rng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function shuffled(n,random){const a=Array.from({length:n},(_,i)=>i+1);for(let i=n-1;i>0;i--){let j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function roundRobin(groups){const result=[];let i=0;while(result.length<groups.reduce((n,g)=>n+g.length,0)){for(const group of groups)if(i<group.length)result.push(group[i]);i++;}return result;}
function hotCold(sorted){const result=[];for(let left=0,right=sorted.length-1;left<=right;left++,right--){result.push(sorted[left]);if(left<right)result.push(sorted[right]);}return result;}
export function numberStats(data,end=data.length){
 return [['red',33],['blue',16]].reduce((out,[color,n])=>{out[color]=Array.from({length:n},(_,j)=>({number:j+1,count:0,last100:0,last30:0,omission:end}));for(let i=0;i<end;i++){for(const v of color==='red'?data[i].red:[data[i].blue]){const s=out[color][v-1];s.count++;if(i>=end-100)s.last100++;if(i>=end-30)s.last30++;s.omission=end-1-i;}}return out;},{});
}
function rankFromHistory(data,t,c){
 if(c.strategy==='combined'){
  const rankings=c.methods.map(strategy=>rankFromHistory(data,t,{...c,strategy}));
  return Object.fromEntries([['red',33],['blue',16]].map(([color,n])=>{
   const scores=new Array(n).fill(0);
   for(const ranking of rankings)ranking[color].forEach((number,index)=>scores[number-1]+=n-index);
   return [color,Array.from({length:n},(_,i)=>i+1).sort((a,b)=>scores[b-1]-scores[a-1]||a-b)];
  }));
 }
 if(c.strategy==='random'){const random=rng((c.seed^Math.imul(t+1,2654435761))>>>0);return{red:shuffled(33,random),blue:shuffled(16,random)};}
 const out={};for(const [color,n] of [['red',33],['blue',16]]){
  const a=new Array(n).fill(0);let start=Math.max(0,t-100);
  if(c.strategy==='overdue'){a.fill(t);for(let i=t-1;i>=0;i--){for(const v of color==='red'?data[i].red:[data[i].blue])if(a[v-1]===t)a[v-1]=t-1-i;} }
  else for(let i=start;i<t;i++){let weight=c.strategy==='blend'?7+(i>=t-30?10:0):c.strategy==='hot30'?(i>=t-30?1:0):1;for(const v of color==='red'?data[i].red:[data[i].blue])a[v-1]+=weight;}
  const hot=Array.from({length:n},(_,i)=>i+1).sort((x,y)=>a[y-1]-a[x-1]||x-y);
  if(c.strategy==='cold100')out[color]=[...hot].sort((x,y)=>a[x-1]-a[y-1]||x-y);
  else if(c.strategy==='hotcold')out[color]=hotCold(hot);
  else if(c.strategy==='oddeven'&&color==='red')out[color]=roundRobin([hot.filter(v=>v%2===1),hot.filter(v=>v%2===0)]);
  else if(c.strategy==='zones'&&color==='red')out[color]=roundRobin([hot.filter(v=>v<=11),hot.filter(v=>v>=12&&v<=22),hot.filter(v=>v>=23)]);
  else out[color]=hot;
 }return out;
}
export function selectNumbers(data,t,c){
 if(c.strategy==='manual')return{red:c.manual.red??[],dan:c.manual.dan??[],tuo:c.manual.tuo??[],blue:c.manual.blue};
 const r=rankFromHistory(data,t,c);const sort=a=>a.sort((a,b)=>a-b);
 return{red:c.type==='pool'?sort(r.red.slice(0,c.redCount)):[],dan:c.type==='dan'?sort(r.red.slice(0,c.danCount)):[],tuo:c.type==='dan'?sort(r.red.slice(c.danCount,c.danCount+c.tuoCount)):[],blue:sort(r.blue.slice(0,c.blueCount))};
}
export function grade(r,b,special=false){if(r===6)return b?1:2;if(r===5)return b?3:4;if(r===4)return b?4:5;if(r===3&&b)return 5;if(b)return 6;if(r===3&&special)return 7;return 0;}
export function scoreDraw(draw,pick,c){
 const actual=new Set(draw.red);const count=a=>a.filter(v=>actual.has(v)).length;const hd=count(pick.dan),pool=c.type==='dan'?pick.tuo:pick.red,h=count(pool),hb=Number(pick.blue.includes(draw.blue));const need=c.type==='dan'?6-pick.dan.length:6;const ct=new Array(8).fill(0);
 for(let k=0;k<=need;k++){let ways=choose(h,k)*choose(pool.length-h,need-k);for(const [b,m] of [[1,hb],[0,pick.blue.length-hb]])ct[grade(hd+k,b,draw.special)]+=ways*m;}
 const awards=[0,draw.first,draw.second,3000,200,10,5,5];let payout=0,unknown=0;for(let i=1;i<=7;i++)if(ct[i]){if(i<=2&&!(awards[i]>0))unknown+=ct[i];else payout+=ct[i]*awards[i];}
 return{counts:ct,payout,unknown,redHits:hd+h,danHits:hd,blueHit:hb};
}
export function runBacktest(data,input,progress=()=>{}){
 const c=validateConfig(input,data.length),tickets=betCount(c),cost=tickets*2,start=c.end-c.periods;let cumulativePrize=0,cumulativeCost=0,totalUnknown=0,winningPeriods=0,profitablePeriods=0;const counts=new Array(8).fill(0),records=[];
 for(let i=start;i<c.end;i++){
  const pick=selectNumbers(data,i,c),score=scoreDraw(data[i],pick,c);cumulativeCost+=cost;cumulativePrize+=score.payout;totalUnknown+=score.unknown;
  if(score.counts.slice(1).some(x=>x>0))winningPeriods++;if(score.payout>cost)profitablePeriods++;score.counts.forEach((v,i)=>counts[i]+=v);
  records.push({issue:data[i].issue,date:data[i].date,actualRed:data[i].red,actualBlue:data[i].blue,pick,...score,cost,net:score.payout-cost,cumulativeCost,cumulativePrize});if((i-start)%100===0)progress((i-start)/c.periods);
 }
 return{config:c,tickets,costPerPeriod:cost,startIssue:data[start].issue,endIssue:data[c.end-1].issue,startDate:data[start].date,endDate:data[c.end-1].date,periods:c.periods,cost:cumulativeCost,prize:cumulativePrize,net:cumulativePrize-cumulativeCost,unknown:totalUnknown,winningPeriods,profitablePeriods,counts,records};
}
export function predict(data,input){const c=validateConfig(input,data.length,true);return{config:c,pick:selectNumbers(data,data.length,c),tickets:betCount(c),stats:numberStats(data),lastIssue:data.at(-1).issue,date:data.at(-1).date};}
