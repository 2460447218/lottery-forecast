<script setup>
import {computed,onUnmounted,ref,toRaw} from 'vue';
import {COMBINABLE} from '../engine.mjs';
import {money} from '../utils.js';
const props=defineProps({draws:Array,end:Number,periods:Number});
const emit=defineEmits(['error','apply']);
const methods=ref(['hot100','cold100','zones']),budget=ref(10),result=ref(null),running=ref(false),progress=ref(0),sort=ref('returnRate');
let worker;
const rows=computed(()=>result.value?[...result.value.rows].sort((a,b)=>b.training[sort.value]-a.training[sort.value]||a.costPerPeriod-b.costPerPeriod):[]);
const winners=computed(()=>result.value?[['历史中奖期比例最高',result.value.bestWin],['历史回报率最高',result.value.bestReturn]].map(([title,id])=>({title,row:result.value.rows.find(row=>row.id===id)})):[]);
const percent=n=>(n*100).toFixed(1)+'%';
function run(){
 if(running.value)return;
 running.value=true;progress.value=0;emit('error','');
 worker=new Worker(new URL('../comparison-worker.mjs',import.meta.url),{type:'module'});
 const stop=()=>{worker?.terminate();worker=null;running.value=false;};
 worker.onmessage=({data})=>{if(data.progress!==undefined){progress.value=data.progress;return;}stop();if(data.error)emit('error',data.error);else result.value=data.result;};
 worker.onerror=()=>{stop();emit('error','方案对比运行失败，请重试。');};
 worker.postMessage({draws:toRaw(props.draws),config:{methods:[...methods.value],budget:budget.value,periods:props.periods,end:props.end,seed:20260930}});
}
onUnmounted(()=>worker?.terminate());
</script>
<template>
 <section class="card comparison-card" aria-label="多选组合与预算对比">
  <div class="card-heading"><div><h2>多选组合 · 预算对比</h2><p>勾选规则，比较每种单独规则和等权组合。在下方设置回测期数及截止期号。</p></div></div>
  <fieldset :disabled="running" class="comparison-controls"><legend>参与对比的选号方式（至少两种）</legend><div class="comparison-methods"><label v-for="[key,name] in COMBINABLE" :key="key" class="check-row"><input v-model="methods" type="checkbox" :value="key" /><span>{{ name }}</span></label></div><div class="comparison-actions"><label for="comparison-budget">每期预算上限（元）<input id="comparison-budget" v-model.number="budget" type="number" min="2" max="100" step="1" /></label><button type="button" class="primary" @click="run">{{ running ? `正在对比 ${Math.round(progress*100)}%` : '对比单独规则与组合' }}</button></div></fieldset>
  <p class="field-help">等权组合按各规则排名计分，取排名最前的号码，注数由球数决定。对比预设：6红配1 / 2 / 3 / 5 / 10 / 16蓝、7红配1 / 2蓝、8红配1蓝，仅保留预算内方案。固定随机编号以便复现。</p>
  <template v-if="result"><p class="comparison-range">筛选区间 {{ result.trainingStart }}—{{ result.trainingEnd }}（{{ result.trainingPeriods }}期） · 验证区间 {{ result.validationStart }}—{{ result.validationEnd }}（{{ result.validationPeriods }}期） · 每期预算 ≤ {{ money(result.budget) }}</p>
   <div class="comparison-winners"><article v-for="item in winners" :key="item.title"><span>{{ item.title }}</span><h3>{{ item.row.label }} · {{ item.row.betLabel }}</h3><p>每期 {{ money(item.row.costPerPeriod) }} · 中奖期比例 {{ percent(item.row.training.winRate) }} · 奖金 / 投入 {{ percent(item.row.training.returnRate) }}</p><p>后段验证：中奖期比例 {{ percent(item.row.validation.winRate) }} · 回报率 {{ percent(item.row.validation.returnRate) }}</p><button type="button" class="secondary" @click="emit('apply',item.row.config)">查看这套方案的逐期回测</button></article></div>
   <label for="comparison-sort">方案排序（依据前段筛选区间）</label><select id="comparison-sort" v-model="sort"><option value="returnRate">奖金回报率从高到低</option><option value="winRate">中奖期比例从高到低</option><option value="net">模拟净额从高到低</option></select>
   <div class="table-wrap"><table><thead><tr><th>选号规则 / 买法</th><th>每期投入</th><th>筛选中奖期比例</th><th>筛选奖金 / 投入</th><th>筛选净额</th><th>验证中奖期比例</th><th>验证奖金 / 投入</th><th></th></tr></thead><tbody><tr v-for="row in rows" :key="row.id"><td>{{ row.label }}<br /><small>{{ row.betLabel }}</small></td><td>{{ money(row.costPerPeriod) }}</td><td>{{ percent(row.training.winRate) }}</td><td>{{ row.training.unknown ? '≥' : '' }}{{ percent(row.training.returnRate) }}</td><td>{{ row.training.unknown ? '≥' : '' }}{{ money(row.training.net) }}</td><td>{{ percent(row.validation.winRate) }}</td><td>{{ row.validation.unknown ? '≥' : '' }}{{ percent(row.validation.returnRate) }}</td><td><button class="tiny-button" @click="emit('apply',row.config)">查看明细</button></td></tr></tbody></table></div>
   <p class="field-help">组合规则：{{ result.methods.map(key=>COMBINABLE.find(([id])=>id===key)[1]).join(' + ') }}。前段用于选方案，后段仅验证，不参与冠军选择。所有金额为税前；≥表示浮动奖奖金缺失时的下限，不能据此确定真实回报排名。</p>
  </template><p class="field-help">“中奖期比例”指当期至少中一个奖，包含小奖；“最划算”按奖金 / 投入比较。历史最优不保证未来最优。公平独立开奖下，同注数的一等奖理论概率相同，增加注数也会增加成本。</p>
 </section>
</template>
<style scoped>
.comparison-card{margin-bottom:24px;padding:24px}.comparison-controls{border:0;padding:0;margin:0}.comparison-controls legend{font-size:14px;font-weight:600;margin-bottom:12px}.comparison-methods{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.comparison-methods label{margin:0;padding:8px;background:#f1f6f8;border-radius:6px}.comparison-actions{display:flex;align-items:end;gap:16px;margin-top:16px}.comparison-actions label{max-width:220px;margin:0}.comparison-actions button{width:auto;margin:0}.comparison-range{font-size:13px;color:#54717e;margin:20px 0}.comparison-winners{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}.comparison-winners article{padding:18px;border:1px solid #d4e2e8;border-radius:12px;background:#f5f9fa}.comparison-winners span{font-size:12px;color:#587784}.comparison-winners h3{font-size:17px;margin:10px 0}.comparison-winners p{font-size:12px;line-height:1.8}.comparison-card .table-wrap{margin-top:16px}.comparison-card>select{max-width:300px}@media(max-width:760px){.comparison-card{padding:18px}.comparison-methods{grid-template-columns:1fr 1fr}.comparison-actions{align-items:stretch;flex-direction:column}.comparison-actions label{max-width:none}.comparison-winners{grid-template-columns:1fr}}
</style>
