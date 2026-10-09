export function analyzeNumbers(draws,periods,color='red'){
 if(!['red','blue'].includes(color))throw new Error('请选择红球或蓝球。');
 if(!Number.isInteger(periods)||periods<1||periods>draws.length)throw new Error(`统计期数需要是1—${draws.length}的整数。`);
 const start=draws.length-periods,size=color==='red'?33:16;
 const rows=Array.from({length:size},(_,i)=>({number:i+1,count:0,omission:0,maxOmission:0,lastIndex:-1,trend:[]}));
 for(let i=0;i<draws.length;i++){
  const hit=new Set(color==='red'?draws[i].red:[draws[i].blue]);
  for(const row of rows){
   const appeared=hit.has(row.number);row.omission=appeared?0:row.omission+1;if(appeared)row.lastIndex=i;
   if(i>=start){row.count+=Number(appeared);if(row.omission>=row.maxOmission){row.maxLowerBound=row.omission===row.maxOmission?row.maxLowerBound||row.lastIndex<0:row.lastIndex<0;row.maxOmission=row.omission;}row.trend.push({issue:draws[i].issue,date:draws[i].date,hit:Number(appeared),cumulative:row.count,omission:row.omission,lowerBound:row.lastIndex<0});}
  }
 }
 for(const row of rows){
  row.rate=row.count/periods;row.lowerBound=row.lastIndex<0;row.lastIssue=draws[row.lastIndex]?.issue??null;row.lastDate=draws[row.lastIndex]?.date??null;
  let rolling=0;row.trend.forEach((point,i)=>{rolling+=point.hit;if(i>=10)rolling-=row.trend[i-10].hit;point.rolling=rolling;});
 }
 const hot=[...rows].sort((a,b)=>b.count-a.count||a.number-b.number),cold=[...rows].sort((a,b)=>a.count-b.count||a.number-b.number),overdue=[...rows].sort((a,b)=>b.omission-a.omission||a.number-b.number);
 return{color,periods,startIssue:draws[start].issue,endIssue:draws.at(-1).issue,startDate:draws[start].date,endDate:draws.at(-1).date,rows,hot,cold,overdue};
}
export function frequencyOption(analysis,metric='count'){
 const omission=metric==='omission';
 return{animation:false,aria:{enabled:true},grid:{left:48,right:18,top:38,bottom:72},tooltip:{trigger:'axis',confine:true,renderMode:'richText',axisPointer:{type:'shadow'},formatter(items){const row=analysis.rows[items[0]?.dataIndex];return row?`${String(row.number).padStart(2,'0')}号\n出现：${row.count}次（${(row.rate*100).toFixed(1)}%）\n当前遗漏：${row.lowerBound?'≥':''}${row.omission}期`:'';}},xAxis:{type:'category',data:analysis.rows.map(row=>String(row.number).padStart(2,'0')),axisLabel:{interval:0,fontSize:10,rotate:analysis.color==='red'?45:0}},yAxis:{type:'value',name:omission?'遗漏 / 期':'出现 / 次',minInterval:1},dataZoom:[{type:'inside',zoomOnMouseWheel:false},{type:'slider',height:18,bottom:10}],series:[{type:'bar',barMaxWidth:24,itemStyle:{color:omission?'#548c93':analysis.color==='red'?'#d45768':'#3b82be',borderRadius:[4,4,0,0]},data:analysis.rows.map(row=>row[metric])}]};
}
export function numberTrendOption(row,mode='omission'){
 const labels={omission:'遗漏期数',cumulative:'区间累计出现次数',rolling:'区间内最近10期出现次数'};
 return{animation:false,aria:{enabled:true},grid:{left:50,right:20,top:42,bottom:76},tooltip:{trigger:'axis',confine:true,renderMode:'richText',formatter(items){const p=row.trend[items[0]?.dataIndex];return p?`${p.issue}期 · ${p.date}\n${p.hit?'本期出现':'本期未出现'}\n遗漏：${p.lowerBound?'≥':''}${p.omission}期\n区间累计：${p.cumulative}次\n区间内最近10期：${p.rolling}次`:'';}},xAxis:{type:'category',boundaryGap:false,data:row.trend.map(p=>p.issue),axisLabel:{hideOverlap:true}},yAxis:{type:'value',name:labels[mode],minInterval:1},dataZoom:[{type:'inside',zoomOnMouseWheel:false},{type:'slider',height:20,bottom:12}],series:[{name:labels[mode],type:'line',step:mode==='cumulative'?'end':false,showSymbol:row.trend.length<=100,symbolSize:5,lineStyle:{width:2},itemStyle:{color:'#218981'},areaStyle:{opacity:.08},data:row.trend.map(p=>p[mode])}]};
}
