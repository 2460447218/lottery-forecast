const pad=n=>String(n).padStart(2,'0');
const nums=n=>Array.from({length:n},(_,i)=>i+1);
export function trendModel(draws,end=draws.length,count=50){
 const start=Math.max(0,end-count),miss=Array(49).fill(0),seen=Array(49).fill(false),rows=[];
 for(let i=0;i<end;i++){
  const d=draws[i],hits=nums(49).map((_,j)=>j<33?d.red.includes(j+1):d.blue===j-32);
  miss.forEach((v,j)=>{miss[j]=hits[j]?0:v+1;if(hits[j])seen[j]=true;});
  if(i>=start)rows.push({...d,hits,miss:[...miss],known:[...seen]});
 }
 const stats=nums(49).map((_,j)=>{let run=0,longest=0,maxMiss=0;for(const r of rows){run=r.hits[j]?run+1:0;longest=Math.max(longest,run);maxMiss=Math.max(maxMiss,r.miss[j]);}return{count:rows.filter(r=>r.hits[j]).length,maxMiss,longest,current:rows.at(-1)?.miss[j]??0};});
 return{rows,stats,start,end};
}
export function ticketCount(pick){let n=pick.red.length;if(n<6||!pick.blue.length)return 0;let c=1;for(let i=1;i<=6;i++)c=c*(n-i+1)/i;return Math.round(c)*pick.blue.length;}

