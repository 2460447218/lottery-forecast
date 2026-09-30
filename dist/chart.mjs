const W=800,H=270,L=72,R=20,T=20,B=42;
const plotW=W-L-R,plotH=H-T-B;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const compact=n=>Math.abs(n)>=10000?`${(n/10000).toFixed(1)}万`:Math.round(n).toLocaleString('zh-CN');
function ticks(min,max){
 const rough=(max-min)/4||1,power=10**Math.floor(Math.log10(rough)),step=[1,2,5,10].map(v=>v*power).find(v=>v>=rough)||10*power;
 const out=[];for(let v=Math.ceil(min/step)*step;v<=max+step/1000;v+=step)out.push(v);
 return out;
}
export function chartModel(records,mode='cumulative'){
 if(!records.length)throw new Error('图表需要逐期数据。');
 if(!['cumulative','recent'].includes(mode))throw new Error('未知图表模式。');
 const start=mode==='recent'?Math.max(0,records.length-30):0;
 const shown=records.slice(start),end=records.length-1;
 let min=0,max=mode==='cumulative'?Math.max(1,...shown.map(r=>Math.max(r.cumulativeCost,r.cumulativePrize))):Math.max(1,...shown.map(r=>r.net));
 if(mode==='recent')min=Math.min(0,...shown.map(r=>r.net));
 const span=Math.max(1,max-min),pad=span*.08;
 if(mode==='recent'){min-=pad;max+=pad;}else max+=pad;
 const y=v=>T+(max-v)/(max-min)*plotH;
 const points=shown.map((r,i)=>({index:start+i,x:mode==='recent'?L+plotW*(i+.5)/shown.length:L+plotW*(shown.length===1?1:i/(shown.length-1)),costY:y(r.cumulativeCost),prizeY:y(r.cumulativePrize),netY:y(r.net)}));
 return{records,mode,start,end,shown,points,min,max,zeroY:y(0)};
}
export function chartIndexAt(model,x){
 const fraction=clamp((x-L)/plotW,0,1);
 return model.mode==='recent'?model.start+Math.min(model.shown.length-1,Math.floor(fraction*model.shown.length)):Math.round(fraction*(model.records.length-1));
}
export function chartSelection(model,index){
 const i=clamp(index,model.start,model.end),p=model.points[i-model.start];
 if(model.mode==='recent')return `<line x1="${p.x}" x2="${p.x}" y1="${T}" y2="${H-B}" stroke="#607d8b" stroke-width="1" stroke-dasharray="3 4"/><circle cx="${p.x}" cy="${p.netY}" r="5" fill="${model.records[i].net>=0?'#128a80':'#d35d63'}" stroke="#fff" stroke-width="2"/>`;
 return `<line x1="${p.x}" x2="${p.x}" y1="${T}" y2="${H-B}" stroke="#607d8b" stroke-width="1" stroke-dasharray="3 4"/><circle cx="${p.x}" cy="${p.costY}" r="5" fill="#a4b3bf" stroke="#fff" stroke-width="2"/><circle cx="${p.x}" cy="${p.prizeY}" r="5" fill="#128a80" stroke="#fff" stroke-width="2"/>`;
}
export function chartSvg(model){
 const {records,mode,shown,points,min,max,zeroY}=model;
 const grid=ticks(min,max).map(v=>{const y=T+(max-v)/(max-min)*plotH;return `<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="${Math.abs(v)<.001?'#b9c8cf':'#e9eff2'}"/><text x="${L-10}" y="${y+4}" text-anchor="end">${compact(v)}</text>`;}).join('');
 let marks;
 if(mode==='cumulative'){
  const sample=points.length<=300?points:points.filter((_,i)=>i===0||i===points.length-1||i%Math.ceil(points.length/290)===0);
  const line=key=>sample.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${p[key].toFixed(1)}`).join(' ');
  marks=`<path d="${line('costY')}" fill="none" stroke="#a4b3bf" stroke-width="2.5" stroke-dasharray="6 5" vector-effect="non-scaling-stroke"/><path d="${line('prizeY')}" fill="none" stroke="#128a80" stroke-width="3" vector-effect="non-scaling-stroke"/>`;
 }else{
  const width=Math.max(4,plotW/shown.length*.72);
  marks=points.map((p,i)=>{const value=shown[i].net,y=Math.min(zeroY,p.netY),height=Math.max(1,Math.abs(p.netY-zeroY));return `<rect x="${(p.x-width/2).toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="2" fill="${value>=0?'#128a80':'#d35d63'}"/>`;}).join('');
 }
 const first=shown[0],last=shown.at(-1);
 return `<svg id="chart-svg" class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${mode==='recent'?'最近30期逐期净额':'累计投入与已知奖金'}，可用下方滑块查看逐期数据">${grid}${marks}<g id="chart-selection">${chartSelection(model,model.end)}</g><text x="${L}" y="${H-11}">${first.issue}期</text><text x="${W-R}" y="${H-11}" text-anchor="end">${last.issue}期</text><rect class="chart-hit-area" x="${L}" y="${T}" width="${plotW}" height="${plotH}" fill="transparent"/></svg>`;
}
