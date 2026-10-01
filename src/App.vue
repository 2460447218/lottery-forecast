<script setup>
import {nextTick, onMounted, onUnmounted, ref} from 'vue';
import BacktestView from './components/BacktestView.vue';
import PredictionView from './components/PredictionView.vue';
import HistoryView from './components/HistoryView.vue';
import ResearchView from './components/ResearchView.vue';
import {fmt} from './utils.js';

const draws = ref([]);
const tab = ref(location.hash === '#research' ? 'research' : location.hash === '#birthday' ? 'prediction' : 'backtest');
const predictionView = ref(null);
function changeTab(value) {tab.value=value; location.hash=value;}
function syncHash(){if(location.hash==='#research')tab.value='research';else if(location.hash==='#birthday')openBirthday();else if(['backtest','prediction','history'].includes(location.hash.slice(1)))tab.value=location.hash.slice(1);}
async function openBirthday() {
  tab.value = 'prediction';
  location.hash = 'birthday';
  await nextTick();
  predictionView.value?.openBirthday();
}

const error = ref('');
const backtest = ref(null);
let lifecycle;

async function loadDraws() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}draws.json`);
    if (!response.ok) throw new Error('历史数据加载失败，请刷新重试。');
    const data = await response.json();
    if (!Array.isArray(data) || data.length < 501) throw new Error('历史数据格式不完整。');
    draws.value = data;
    registerTools();
  } catch (cause) { error.value = cause.message; }
}

function usePrediction(config, fixed = false) {
  tab.value = 'backtest';
  setTimeout(() => backtest.value?.applyPrediction(config, fixed), 0);
}

function registerTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  lifecycle = new AbortController();
  const tools = [
    {name: 'read_lottery_state', description: '读取开奖数据范围与当前回测摘要。', inputSchema: {type: 'object', properties: {}, additionalProperties: false}, annotations: {readOnlyHint: true}, execute: () => ({draws: draws.value.length, lastIssue: draws.value.at(-1).issue, result: backtest.value?.summary() ?? null})},
    {name: 'run_lottery_backtest', description: '按给定期数与规则运行回测。', inputSchema: {type: 'object', properties: {periods: {type: 'integer', minimum: 1, maximum: draws.value.length - 500}, strategy: {type: 'string', enum: ['hot100', 'blend', 'hot30', 'cold100', 'overdue', 'hotcold', 'oddeven', 'zones', 'random']}, redCount: {type: 'integer', minimum: 6, maximum: 33}, blueCount: {type: 'integer', minimum: 1, maximum: 16}}, required: ['periods', 'strategy', 'redCount', 'blueCount'], additionalProperties: false}, execute: async input => {tab.value = 'backtest'; await new Promise(resolve => setTimeout(resolve, 0)); return backtest.value.runExternal(input);}}
  ];
  for (const tool of tools) Promise.resolve(context.registerTool(tool, {signal: lifecycle.signal})).catch(() => {});
}

onMounted(()=>{loadDraws();window.addEventListener('hashchange',syncHash);});
onUnmounted(() => {lifecycle?.abort();window.removeEventListener('hashchange',syncHash);});
</script>

<template>
  <header class="topbar"><a class="brand" href="./"><span class="brand-mark" aria-hidden="true">双</span><span>双色球研究室<small>NUMBER LAB</small></span></a><div class="top-note">先验证，再判断</div><span class="private-label">历史数据实验台</span></header>
  <div class="workspace">
    <div class="page-title"><div><p class="eyebrow">HISTORY / SIMULATION / INSIGHT</p><h1>把选号想法，放进历史里检验。</h1><p class="subtitle">选择一套规则，看清中奖次数，也看清每一笔成本。</p></div><div class="data-stamp"><strong>{{ fmt(draws.length) }} <small>期历史数据</small></strong><span>{{ draws.length ? `${draws[0].date.replaceAll('-', '.')} — ${draws.at(-1).date.replaceAll('-', '.')}` : '正在加载' }}</span></div></div>
    <nav class="tabs" aria-label="功能切换"><button v-for="item in [['backtest','回测实验'],['prediction','下一期参考'],['history','历史开奖'],['research','规律研究']]" :key="item[0]" class="tab" :class="{active: tab === item[0]}" @click="changeTab(item[0])">{{ item[1] }}</button><span>每期开奖结果互相独立，参考号码不代表更高胜率</span></nav>
    <div v-if="error" id="notice" role="status" aria-live="polite">{{ error }}</div>
    <template v-if="draws.length">
      <BacktestView v-show="tab === 'backtest'" ref="backtest" :draws="draws" @birthday="openBirthday" @error="error = $event" />
      <PredictionView :active="tab === 'prediction'" ref="predictionView" v-show="tab === 'prediction'" :draws="draws" @error="error = $event" @use-prediction="usePrediction" />
      <ResearchView v-if="tab === 'research'" :draws="draws" @error="error = $event" />
      <HistoryView v-if="tab === 'history'" :draws="draws" />
    </template>
    <footer><span>双色球研究室 · 官方开奖公告与历史数据</span><details><summary>数据与计算说明</summary><p>共 {{ fmt(draws.length) }} 期，截止 {{ draws.at(-1)?.issue ?? '—' }} 期。2013年起的开奖号码、日期及一二等奖金额已与中国福利彩票公开查询接口核对；2003—2012年的记录来自原始历史工作簿，尚未逐期核验。GitHub 仓库定时同步官方新开奖，官网延迟或接口故障时沿用上次成功的数据。规则回测保留前500期作初始历史，每期仅使用当时已开奖数据；手动选号属于事后固定号码回看。开奖号码按集合比较，不看顺序。同一注只兑付最高奖级。固定奖按常规金额折算，浮动奖使用表内公布金额（税前），不模拟新增中奖注对奖金分配的影响；计入有记录的福运奖，不计其他促销。历史回报不代表未来收益。</p><p>公平独立开奖下，单注一等奖概率为1/17,721,088。热门或遗漏只是历史统计特征。</p></details></footer>
  </div>
</template>
