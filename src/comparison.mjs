import {COMBINABLE, STRATEGIES, betCount, betLabel, runBacktest, validateConfig} from './engine.mjs';

export function compareStrategies(draws, input, progress = () => {}) {
 const base = validateConfig({...input,strategy:'combined',type:'pool',redCount:6,blueCount:1},draws.length);
 const budget = Number(input.budget);
 if(!Number.isInteger(budget)||budget<2||budget>100)throw new Error('每期预算请选择2—100元的整数。');
 if(base.periods<20)throw new Error('方案对比至少需要20期，以保留独立验证区间。');
 const methods = base.methods;
 const sizes = [[6,1],[6,2],[6,3],[6,5],[6,10],[6,16],[7,1],[7,2],[8,1]];
 const candidates = [ ...methods.map(strategy=>({strategy})), {strategy:'combined',methods} ].flatMap(rule=>sizes.map(([redCount,blueCount])=>({...base,...rule,redCount,blueCount})).filter(c=>betCount(c)*2<=budget));
 const validationPeriods=Math.max(5,Math.floor(base.periods*.3)), trainingPeriods=base.periods-validationPeriods;
 const metric = r => ({cost:r.cost,prize:r.prize,net:r.net,unknown:r.unknown,winningPeriods:r.winningPeriods,periods:r.periods,winRate:r.winningPeriods/r.periods,returnRate:r.prize/r.cost});
 const rows=candidates.map((config,index)=>{
  const training=runBacktest(draws,{...config,end:base.end-validationPeriods,periods:trainingPeriods});
  const validation=runBacktest(draws,{...config,periods:validationPeriods});
  progress((index+1)/candidates.length);
  return {id:index,config,label:STRATEGIES[config.strategy],betLabel:betLabel(config),costPerPeriod:betCount(config)*2,training:metric(training),validation:metric(validation)};
 });
 const order=(key)=>(a,b)=>b.training[key]-a.training[key]||a.costPerPeriod-b.costPerPeriod||a.id-b.id;
 const bestWin=[...rows].sort(order('winRate'))[0].id, bestReturn=[...rows].sort(order('returnRate'))[0].id;
 const start=base.end-base.periods;
 return {rows,bestWin,bestReturn,methods,budget,trainingStart:draws[start].issue,trainingEnd:draws[base.end-validationPeriods-1].issue,validationStart:draws[base.end-validationPeriods].issue,validationEnd:draws[base.end-1].issue,trainingPeriods,validationPeriods};
}
