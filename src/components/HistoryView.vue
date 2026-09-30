<script setup>
import {computed, ref, watch} from 'vue';
import Balls from './Balls.vue';
import {fmt} from '../utils.js';

const props = defineProps({draws: {type: Array, required: true}});
const query = ref('');
const page = ref(0);
const latest = computed(() => props.draws.at(-1));
const filtered = computed(() => [...props.draws].reverse().filter(row => row.issue.includes(query.value.trim()) || row.date.includes(query.value.trim())));
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / 20)));
const shown = computed(() => filtered.value.slice(page.value * 20, (page.value + 1) * 20));
watch(query, () => {page.value = 0;});
</script>

<template>
  <main id="history" class="tab-panel">
    <div class="card history-latest"><div><span class="label-chip">内置数据最新一期</span><h2>{{ latest.issue }} 期</h2><p>{{ latest.date }} · 最近一次成功同步的数据</p></div><Balls :red="latest.red" :blue="[latest.blue]" large /></div>
    <div class="history-tools"><div><h2 style="margin:0 0 6px">历史开奖</h2><p class="history-info">共 {{ fmt(draws.length) }} 期 · 日期从新到旧</p></div><input v-model="query" type="search" placeholder="搜索期号或日期，如 26113" aria-label="搜索历史期号或日期" /></div>
    <div class="card table-card" style="margin-top:0"><div class="table-wrap"><table><thead><tr><th>期号</th><th>开奖日期</th><th>开奖号码</th><th>红球和值</th><th>奇 : 偶</th></tr></thead><tbody><tr v-for="row in shown" :key="row.issue"><td class="num">{{ row.issue }}</td><td class="num">{{ row.date }}</td><td><Balls :red="row.red" :blue="[row.blue]" /></td><td class="num">{{ row.red.reduce((sum, n) => sum + n, 0) }}</td><td class="num">{{ row.red.filter(n => n % 2).length }} : {{ row.red.filter(n => n % 2 === 0).length }}</td></tr><tr v-if="!shown.length"><td colspan="5" class="empty">没有找到匹配的期号或日期。</td></tr></tbody></table></div>
      <div class="pager"><span>共 {{ fmt(filtered.length) }}期 · {{ page + 1 }} / {{ pages }}页</span><div class="pager-buttons"><button class="secondary" :disabled="page === 0" @click="page--">上一页</button><button class="secondary" :disabled="page >= pages - 1" @click="page++">下一页</button></div></div>
    </div>
  </main>
</template>
