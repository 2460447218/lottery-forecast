<script setup>
import {computed,defineAsyncComponent} from 'vue';
import {downloadCsv,money} from '../utils.js';
const EChart=defineAsyncComponent(()=>import('./EChart.vue'));
const props=defineProps({result:Object});
const percent=n=>(n*100).toFixed(1)+'%';
const s=computed(()=>props.result.stability);
const chart=computed(()=>{
 const bounds=[0,.1,.2,.3,.4,.5,.75,1,2,Infinity],labels=['0–10%','10–20%','20–30%','30–40%','40–50%','50–75%','75–100%','100–200%','≥200%'];
 return {animation:false,tooltip:{trigger:'axis',valueFormatter:v=>`${v}个编号`},grid:{left:45,right:20,top:24,bottom:85},xAxis:{type:'category',data:labels,axisLabel:{rotate:35}},yAxis:{type:'value',name:'编号数',minInterval:1},series:[{type:'bar',data:bounds.slice(0,-1).map((low,i)=>s.value.samples.filter(row=>row.returnRate>=low&&row.returnRate<bounds[i+1]).length),itemStyle:{color:'#278b88',borderRadius:[4,4,0,0]}}]};
});
function exportSamples(){downloadCsv(`多注稳定性_${props.result.endIssue}.csv`,[['规则',props.result.config.strategy,'红球重复上限',props.result.config.maxOverlap,'蓝球模式',props.result.config.blueMode],['随机编号','奖金','净额','回报率','中奖期比例','最长连续未中奖期数','未知奖金注数'],...s.value.samples.map(row=>[row.seed,row.prize,row.net,row.returnRate,row.winRate,row.longestNoWin,row.unknown])]);}
</script>
<template>
 <section v-if="s" class="card padded multi-stability"><div class="card-heading"><div><h3>同一方法的100次组号是否稳定</h3><p>相同规则、球池、注数、期数，只改变随机编号。</p></div><button class="secondary" @click="exportSamples">导出100次结果</button></div><p class="field-help">本次设置：每两注最多重复{{ result.config.maxOverlap }}红 · 蓝球{{ result.config.blueMode==='balanced'?'优先分散':'允许重复' }}。每个样本投入都是{{ money(result.cost) }}；100次为独立模拟，不是把投入叠加100倍。</p>
 <div class="metrics"><article class="metric"><span>平均 / 中位回报率</span><strong>{{ percent(s.meanReturn) }}</strong><small>中位数 {{ percent(s.medianReturn) }}</small></article><article class="metric"><span>亏损样本比例</span><strong>{{ percent(s.lossRate) }}</strong><small>奖金低于总投入的编号占比</small></article><article class="metric"><span>最长连续未中奖</span><strong>{{ s.longestNoWin }}<em>期</em></strong><small>100个编号中最久的一次</small></article><article class="metric"><span>连续未中奖最长值的中位数</span><strong>{{ s.medianNoWin }}<em>期</em></strong><small>先求各编号最长值，再取中位数</small></article></div>
 <EChart :option="chart" label="100个随机编号的奖金回报率分布" />
 <h3>与普通组号比较</h3><p class="field-help">双方使用相同规则、候选池、成本及同一批随机编号。普通组号只排除完全重复的红球组合，蓝球允许重复。</p><div class="table-wrap"><table><thead><tr><th>方式</th><th>平均回报</th><th>中位回报</th><th>平均中奖期比例</th><th>亏损样本</th><th>最长未中奖中位数</th></tr></thead><tbody><tr v-for="[label,row] in [['当前设置',s],['普通组号',s.ordinary]]" :key="label"><td>{{ label }}</td><td>{{ percent(row.meanReturn) }}</td><td>{{ percent(row.medianReturn) }}</td><td>{{ percent(row.meanWin) }}</td><td>{{ percent(row.lossRate) }}</td><td>{{ row.medianNoWin }}期</td></tr></tbody></table></div>
 <div class="table-wrap"><table><thead><tr><th>样本</th><th>随机编号</th><th>回报率</th><th>模拟净额</th><th>最长未中奖</th></tr></thead><tbody><tr v-for="[label,row] in [['最好',s.best],['最差',s.worst]]" :key="label"><td>{{ label }}</td><td>{{ row.seed }}</td><td>{{ percent(row.returnRate) }}</td><td>{{ money(row.net) }}</td><td>{{ row.longestNoWin }}期</td></tr></tbody></table></div>
 <p class="field-help">回报率100%才是收支相抵。最好与最差仅描述本批次范围，不据此推荐随机编号。{{ s.unknownSamples?`${s.unknownSamples}个样本有浮动奖金缺失：金额和回报率是下限，亏损比例是按已知奖金计算的暂定值。`:'' }}这些模拟共用同一段开奖历史，衡量的是随机组号差异，不能当作100段独立的未来开奖证据。</p></section>
</template>
<style scoped>
.multi-stability{margin-bottom:24px}.multi-stability .metrics{margin-top:18px}.multi-stability .metric strong{font-size:25px}.multi-stability .table-wrap{margin-top:12px}
</style>
