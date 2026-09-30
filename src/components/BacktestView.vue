<script setup>
import {computed, onMounted, onUnmounted, reactive, ref, shallowRef, toRaw, watch} from 'vue';
import {STRATEGIES, GRADES, TOTAL, betCount, betLabel, validateConfig, predict} from '../engine.mjs';
import {chartModel, chartSvg, chartSelection, chartIndexAt} from '../chart.mjs';
import {fmt, money, pad, freshSeed, downloadCsv} from '../utils.js';
import Balls from './Balls.vue';

const props = defineProps({draws: {type: Array, required: true}});
const emit = defineEmits(['error']);
const config = reactive({strategy: 'hot100', type: 'pool', redCount: 6, blueCount: 2, danCount: 4, tuoCount: 5, seed: 20260930, freshRandom: true, periods: 1000, end: props.draws.length, manual: {red: [], blue: [], dan: [], tuo: []}});
const result = shallowRef(null);
const running = ref(false);
const progress = ref(0);
const page = ref(0);
const detailIssue = ref(null);
const filters = reactive({query: '', scope: 'all', outcome: 'all', grade: 'all'});
const chartMode = ref('cumulative');
const chartIndex = ref(0);
let worker;

const help = {hot100: '按当时之前100期的出现次数排序；相同数据和设置会得到相同结果。', blend: '70%近100期频率 + 30%近30期频率。', hot30: '按当时之前30期的出现次数排序。', cold100: '选择当时之前100期出现次数较少的号码。', overdue: '选择截至当时连续未出现期数最长的号码。', hotcold: '按此前100期出现次数排序，冷热两端交替取号。', oddeven: '红球按奇、偶交替取号。', zones: '红球按1—11、12—22、23—33三区轮流取号。', random: '每一期都随机生成号码；可固定随机编号复现结果。', manual: '固定这组号码回看历史，属于事后分析。'};
const maxPeriods = computed(() => config.end - (config.strategy === 'manual' ? 0 : 500));
const stake = computed(() => {try {return betCount(validateConfig({...config, strategy: config.strategy === 'manual' ? 'hot100' : config.strategy}, props.draws.length, true)) * 2;} catch {return null;}});
const betDescription = computed(() => {try {const c = validateConfig({...config, strategy: config.strategy === 'manual' ? 'hot100' : config.strategy}, props.draws.length, true); return `${betLabel(c)} · ${fmt(betCount(c))}注 × ¥2`;} catch {return '请检查号码个数';}});
const pickerGroups = computed(() => config.type === 'dan' ? [['dan', '红球胆码', 33, config.danCount], ['tuo', '红球拖码', 33, config.tuoCount], ['blue', '蓝球', 16, config.blueCount]] : [['red', '红球', 33, config.redCount], ['blue', '蓝球', 16, config.blueCount]]);
const chart = computed(() => result.value ? chartModel(result.value.records, chartMode.value) : null);
const chartMarkup = computed(() => chart.value ? chartSvg(chart.value).replace(/<g id="chart-selection">[\s\S]*?<\/g>/, `<g id="chart-selection">${chartSelection(chart.value, chartIndex.value)}</g>`) : '');
const chartRow = computed(() => result.value?.records[chartIndex.value]);
const filtered = computed(() => {
  if (!result.value) return [];
  let records = [...result.value.records].reverse();
  if (filters.scope !== 'all') records = records.slice(0, Number(filters.scope));
  return records.filter(row => {
    const won = row.counts.slice(1).some(Boolean);
    const outcome = filters.outcome === 'all' || filters.outcome === 'wins' && won || filters.outcome === 'none' && !won || filters.outcome === 'profit' && row.payout > row.cost;
    return outcome && (!filters.query || row.issue.includes(filters.query.trim()) || row.date.includes(filters.query.trim())) && (filters.grade === 'all' || row.counts[Number(filters.grade)] > 0);
  });
});
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / 15)));
const shown = computed(() => filtered.value.slice(page.value * 15, (page.value + 1) * 15));
const returnRate = computed(() => result.value ? result.value.prize / result.value.cost * 100 : 0);
const bestGrade = computed(() => result.value ? result.value.counts.slice(1).findIndex(Boolean) + 1 : 0);
const maxPrize = computed(() => result.value ? Math.max(...result.value.records.map(row => row.payout)) : 0);

watch(() => [filters.query, filters.scope, filters.outcome, filters.grade], () => {page.value = 0; detailIssue.value = null;});
watch(maxPeriods, value => {if (config.periods > value) config.periods = Math.max(1, value);});
watch(chartMode, () => {if (chart.value) chartIndex.value = chart.value.end;});

function choosePeriod(value) {config.periods = value === 'all' ? maxPeriods.value : Math.min(value, maxPeriods.value);}
function pick(key, number, max) {
  const selected = config.manual[key];
  if (selected.includes(number)) config.manual[key] = selected.filter(value => value !== number);
  else if (selected.length < max && !(key === 'dan' && config.manual.tuo.includes(number)) && !(key === 'tuo' && config.manual.dan.includes(number))) config.manual[key] = [...selected, number].sort((a, b) => a - b);
  else emit('error', `最多选择${max}个号码，胆码和拖码不能重复。`);
}
function fillPicks() {try {config.manual = structuredClone(predict(props.draws, {...config, strategy: 'hot100'}).pick); emit('error', '');} catch (error) {emit('error', error.message);}}
function clearPicks() {config.manual = {red: [], blue: [], dan: [], tuo: []};}
function isBlocked(key, number) {return key === 'dan' ? config.manual.tuo.includes(number) : key === 'tuo' ? config.manual.dan.includes(number) : false;}
function run() {
  if (running.value) return Promise.reject(new Error('正在运行回测，请稍候。'));
  let input;
  try {
    if (config.strategy === 'random' && config.freshRandom) config.seed = freshSeed();
    input = validateConfig(structuredClone(toRaw(config)), props.draws.length);
  } catch (error) {emit('error', error.message); return Promise.reject(error);}
  emit('error', ''); running.value = true; progress.value = 0;
  return new Promise((resolve, reject) => {
    worker?.terminate();
    worker = new Worker(new URL('../worker.mjs', import.meta.url), {type: 'module'});
    const done = () => {running.value = false; worker?.terminate(); worker = null;};
    worker.onmessage = ({data}) => {
      if (data.progress !== undefined) {progress.value = data.progress; return;}
      if (data.error) {done(); emit('error', data.error); reject(new Error(data.error)); return;}
      result.value = data.result; page.value = 0; detailIssue.value = null; chartIndex.value = data.result.records.length - 1; done(); resolve(data.result);
    };
    worker.onerror = () => {done(); emit('error', '回测暂时无法运行，请刷新后重试。'); reject(new Error('回测计算失败'));};
    worker.postMessage({draws: toRaw(props.draws), config: input});
  });
}
function rerunRandom() {config.strategy = 'random'; config.freshRandom = true; run().catch(() => {});}
function selectChartFromPointer(event) {
  if (!event.target.classList?.contains('chart-hit-area') || !chart.value) return;
  const rect = event.target.getBoundingClientRect();
  chartIndex.value = chartIndexAt(chart.value, 72 + (event.clientX - rect.left) / rect.width * 708);
}
function resetFilters() {Object.assign(filters, {query: '', scope: 'all', outcome: 'all', grade: 'all'});}
function exportResults() {
  if (!result.value) return;
  const r = result.value;
  downloadCsv(`双色球回测_${r.startIssue}-${r.endIssue}.csv`, [['规则', STRATEGIES[r.config.strategy], '买法', betLabel(r.config)], ['期号', '日期', '所选红球', '胆码', '拖码', '蓝球', '实际红球', '实际蓝球', '投入', '已知奖金', '已知奖金减投入', '缺失浮动奖金注数', ...GRADES.slice(1)], ...r.records.map(row => [row.issue, row.date, row.pick.red.map(pad).join(' '), row.pick.dan.map(pad).join(' '), row.pick.tuo.map(pad).join(' '), row.pick.blue.map(pad).join(' '), row.actualRed.map(pad).join(' '), pad(row.actualBlue), row.cost, row.payout, row.net, row.unknown, ...row.counts.slice(1)])]);
}
function applyPrediction(prediction, fixed) {
  const p = prediction;
  Object.assign(config, {...p.config, strategy: fixed ? 'manual' : p.config.strategy, periods: Math.min(1000, props.draws.length - 500), end: props.draws.length});
  if (fixed) config.manual = structuredClone(toRaw(p.pick));
  run().catch(() => {});
}
async function runExternal(input) {
  Object.assign(config, {strategy: input.strategy, type: 'pool', redCount: input.redCount, blueCount: input.blueCount, periods: input.periods, end: props.draws.length, seed: 20260930});
  const r = await run();
  return {periods: r.periods, cost: r.cost, knownPrize: r.prize, net: r.net, unknownPrizeTickets: r.unknown, winningPeriods: r.winningPeriods};
}
function summary() {const r = result.value; return r ? {strategy: r.config.strategy, periods: r.periods, cost: r.cost, knownPrize: r.prize, unknownPrizeTickets: r.unknown, winningPeriods: r.winningPeriods} : null;}
defineExpose({applyPrediction, runExternal, summary});
onMounted(() => run().catch(() => {}));
onUnmounted(() => worker?.terminate());
</script>

<template>
  <main id="backtest" class="tab-panel"><div class="experiment-layout"><aside class="config card"><div class="section-kicker"><span>01</span> 配置你的实验</div><h2>回测设置</h2><form @submit.prevent="run().catch(() => {})">
    <label for="periods">回测期数 <small>截止所选开奖期</small></label><div class="quick-buttons"><button v-for="option in [[100,'100期'],[500,'500期'],[1000,'1000期'],['all','全部可用']]" :key="option[0]" type="button" :class="{selected: config.periods === (option[0] === 'all' ? maxPeriods : option[0])}" @click="choosePeriod(option[0])">{{ option[1] }}</button></div><input id="periods" v-model.number="config.periods" type="number" min="1" :max="maxPeriods" step="1" required aria-label="自定义回测期数" /><label for="end-issue">截止期号</label><select id="end-issue" v-model.number="config.end"><option v-for="(row, index) in draws.slice(500).reverse()" :key="row.issue" :value="draws.length - index">{{ row.issue }} · {{ row.date }}</option></select>
    <label for="strategy">选号方式</label><select id="strategy" v-model="config.strategy"><option v-for="(label, key) in STRATEGIES" :key="key" :value="key">{{ label }}</option></select><p class="field-help">{{ help[config.strategy] }}</p>
    <label for="bet-type">投注方式</label><select id="bet-type" v-model="config.type"><option value="pool">单式 / 复式</option><option value="dan">红球胆拖</option></select><div v-if="config.type === 'pool'" class="two-col"><div><label for="red-count">红球个数</label><input id="red-count" v-model.number="config.redCount" type="number" min="6" max="33" required /></div><div><label for="blue-count">蓝球个数</label><input id="blue-count" v-model.number="config.blueCount" type="number" min="1" max="16" required /></div></div><div v-else><div class="two-col"><div><label for="dan-count">胆码个数</label><input id="dan-count" v-model.number="config.danCount" type="number" min="1" max="5" /></div><div><label for="tuo-count">拖码个数</label><input id="tuo-count" v-model.number="config.tuoCount" type="number" min="2" max="29" /></div></div><label for="dan-blue-count">蓝球个数</label><input id="dan-blue-count" v-model.number="config.blueCount" type="number" min="1" max="16" /><p class="field-help">胆码固定出现在每一注中；拖码与胆码不能重复。</p></div>
    <div v-if="config.strategy === 'manual'" id="manual-picker"><template v-for="[key, label, max, target] in pickerGroups" :key="key"><div class="picker-title">{{ label }}<span>已选 {{ config.manual[key].length }} / {{ target }}</span></div><div class="number-grid" role="group" :aria-label="`选择${label}`"><button v-for="number in max" :key="number" type="button" class="number-button" :class="[key, {selected: config.manual[key].includes(number)}]" :aria-label="`${label}${pad(number)}`" :aria-pressed="config.manual[key].includes(number)" :disabled="isBlocked(key, number)" @click="pick(key, number, target)">{{ pad(number) }}</button></div></template><div class="picker-actions"><button type="button" @click="clearPicks">清空号码</button><button type="button" @click="fillPicks">用当前热号填入</button></div></div>
    <div v-if="config.strategy === 'random'"><label class="check-row"><input v-model="config.freshRandom" type="checkbox" /><span>每次运行重新随机</span></label><label for="seed">本次随机编号 <small>取消勾选后可复现</small></label><input id="seed" v-model.number="config.seed" type="number" min="1" max="4294967295" :disabled="config.freshRandom" /></div>
    <div class="stake-box"><div><span>每期投入</span><strong>{{ stake === null ? '—' : money(stake) }}</strong></div><p>{{ betDescription }}</p></div><button class="primary" type="submit" :disabled="running"><span v-if="!running" class="play-icon" aria-hidden="true">▶</span>{{ running ? `正在计算 ${Math.round(progress * 100)}%` : '运行回测' }}</button><p class="field-help small-note">模拟计算，不提供购买彩票服务。</p></form></aside>
    <section class="results" aria-label="回测结果"><div class="result-heading"><div><div class="section-kicker"><span>02</span> 用数据看结果</div><h2>{{ result ? `${STRATEGIES[result.config.strategy]} · ${betLabel(result.config)}` : '正在计算回测' }}</h2><p>{{ result ? `${result.startIssue}—${result.endIssue}期 · ${fmt(result.periods)}期 · 每期${fmt(result.tickets)}注 · 税前模拟` : '请稍候' }}</p></div><div class="result-actions"><button v-if="result?.config.strategy === 'random'" class="secondary" @click="rerunRandom">再随机一次</button><button class="secondary" :disabled="!result" @click="exportResults">导出明细</button></div></div>
      <div v-if="result" id="result-body" :class="{loading: running}"><div v-if="result.config.strategy === 'random'" class="notice-banner">这是第 {{ result.config.seed }} 号随机样本。单次样本不代表真实长期概率。</div><div v-if="result.config.strategy === 'manual'" class="notice-banner">固定号码历史回看：这组号码是在现在选定的，历史命中不等于当时能提前预测。</div><div v-if="result.unknown" class="notice-banner">有浮动奖奖金字段缺失。下方显示已知奖金下限。</div>
        <div class="metrics"><article class="metric"><span>模拟总成本</span><strong>{{ money(result.cost) }}</strong><small>每期 {{ money(result.costPerPeriod) }} × {{ fmt(result.periods) }}期</small></article><article class="metric"><span>{{ result.unknown ? '已知奖金下限' : '奖金合计' }}</span><strong>{{ result.unknown ? '≥' : '' }}{{ money(result.prize) }}</strong><small>含适用期间福运奖 · 税前</small></article><article class="metric" :class="result.net < 0 ? 'loss' : 'profit'"><span>模拟净额</span><strong>{{ result.unknown ? '≥' : '' }}{{ money(result.net) }}</strong><small>奖金 − 投入</small></article><article class="metric"><span>中奖期比例</span><strong>{{ (result.winningPeriods / result.periods * 100).toFixed(1) }}<em>%</em></strong><small>{{ fmt(result.winningPeriods) }} / {{ fmt(result.periods) }}期有奖</small></article></div>
        <div class="card chart-card"><div class="card-heading"><div><h3>{{ chartMode === 'recent' ? '近30期逐期盈亏' : '累计投入与奖金' }}</h3><p>{{ chartMode === 'recent' ? '绿色为当期盈利，红色为当期亏损。' : '移动鼠标或拖动滑块，查看任一期的投入与奖金。' }}</p></div><div class="chart-controls"><div class="chart-mode" role="group" aria-label="图表视图"><button type="button" :class="{selected: chartMode === 'cumulative'}" :aria-pressed="chartMode === 'cumulative'" @click="chartMode = 'cumulative'">累计走势</button><button type="button" :class="{selected: chartMode === 'recent'}" :aria-pressed="chartMode === 'recent'" @click="chartMode = 'recent'">近30期盈亏</button></div><div class="legend"><span><i :class="chartMode === 'recent' ? 'profit-key' : 'cost-key'"></i>{{ chartMode === 'recent' ? '盈利' : '投入' }}</span><span><i :class="chartMode === 'recent' ? 'loss-key' : 'prize-key'"></i>{{ chartMode === 'recent' ? '亏损' : '奖金' }}</span></div></div></div><div id="chart-visual" v-html="chartMarkup" @pointermove="selectChartFromPointer"></div><label class="chart-scrub-label" for="chart-scrub">选择开奖期</label><input id="chart-scrub" v-model.number="chartIndex" class="chart-scrub" type="range" :min="chart.start" :max="chart.end" /><div v-if="chartRow" class="chart-readout" aria-live="polite"><strong>{{ chartRow.issue }}期 <small>{{ chartRow.date }}</small></strong><span>投入 <b>{{ money(chartRow.cost) }}</b></span><span>奖金 <b>{{ chartRow.unknown ? '≥' : '' }}{{ money(chartRow.payout) }}</b></span><span>当期净额 <b :class="chartRow.net < 0 ? 'amount-negative' : 'amount-positive'">{{ money(chartRow.net) }}</b></span><template v-if="chartMode === 'cumulative'"><span>累计投入 <b>{{ money(chartRow.cumulativeCost) }}</b></span><span>累计奖金 <b>{{ money(chartRow.cumulativePrize) }}</b></span></template></div></div>
        <div class="result-bottom"><div class="card padded"><div class="card-heading"><div><h3>奖级分布</h3><p>展开后的中奖注数，同一期可中多注。</p></div></div><div v-for="(count, index) in result.counts.slice(1)" :key="index" class="prize-bar"><span>{{ GRADES[index + 1] }}</span><div class="prize-track"><i :style="{width: count ? `${Math.max(2, Math.log1p(count) / Math.log1p(Math.max(...result.counts.slice(1), 1)) * 100)}%` : '0%'}"></i></div><b>{{ fmt(count) }}</b></div></div><div class="card padded"><h3>不只看中奖次数</h3><ul class="summary-list"><li><span>奖金 / 投入</span><b>{{ returnRate.toFixed(2) }}%</b></li><li><span>奖金超过当期成本</span><b>{{ fmt(result.profitablePeriods) }}期</b></li><li><span>单期最高已知奖金</span><b>{{ money(maxPrize) }}</b></li><li><span>最高命中奖级</span><b>{{ bestGrade ? GRADES[bestGrade] : '未中奖' }}</b></li><li><span>同注数一等奖理论概率</span><b>约 {{ fmt(Math.round(TOTAL / result.tickets)) }} 分之一</b></li></ul><p class="field-help">理论概率假设公平独立开奖。历史表现不保证未来收益。</p></div></div>
        <div class="card table-card"><div class="card-heading"><div><h3>逐期明细</h3><p>按期号、时间和结果筛选；展开查看当时所选号码。</p></div></div><div class="result-filters"><div><label for="result-search">期号 / 日期</label><input id="result-search" v-model="filters.query" type="search" placeholder="搜索期号或日期" /></div><div><label for="result-scope">时间范围</label><select id="result-scope" v-model="filters.scope"><option value="all">回测全部期数</option><option value="30">最近30期</option><option value="100">最近100期</option><option value="500">最近500期</option></select></div><div><label for="result-filter">结果</label><select id="result-filter" v-model="filters.outcome"><option value="all">全部结果</option><option value="wins">有中奖</option><option value="none">未中奖</option><option value="profit">已知奖金高于成本</option></select></div><div><label for="result-grade">奖级</label><select id="result-grade" v-model="filters.grade"><option value="all">所有奖级</option><option v-for="(name, index) in GRADES.slice(1)" :key="name" :value="String(index + 1)">{{ name }}</option></select></div><button type="button" class="secondary" @click="resetFilters">重置筛选</button></div><p class="filter-summary">找到 {{ fmt(filtered.length) }} / {{ fmt(result.records.length) }} 期 · 按最新期号排序</p><div class="table-wrap"><table><thead><tr><th>期号 / 日期</th><th>球池命中</th><th>最高奖级</th><th>当期奖金</th><th>当期净额</th><th></th></tr></thead><tbody><template v-for="row in shown" :key="row.issue"><tr><td><strong class="num">{{ row.issue }}</strong><br /><span class="field-help">{{ row.date }}</span></td><td>{{ row.redHits }}红 + {{ row.blueHit }}蓝<span v-if="result.config.type === 'dan'"><br /><span class="field-help">其中胆码 {{ row.danHits }}/{{ result.config.danCount }}</span></span></td><td><span v-if="row.counts.slice(1).some(Boolean)" class="badge">{{ GRADES[row.counts.slice(1).findIndex(Boolean) + 1] }}</span><span v-else>—</span></td><td class="num">{{ row.unknown ? '≥' : '' }}{{ money(row.payout) }}</td><td class="num" :class="row.net < 0 ? 'amount-negative' : 'amount-positive'">{{ money(row.net) }}</td><td><button class="tiny-button" :aria-expanded="detailIssue === row.issue" @click="detailIssue = detailIssue === row.issue ? null : row.issue">{{ detailIssue === row.issue ? '收起' : '查看' }}</button></td></tr><tr v-if="detailIssue === row.issue" class="detail-expansion"><td colspan="6"><div class="detail-columns"><div><p>{{ result.config.type === 'dan' ? '当时所选胆码' : '当时所选号码' }} · 实心球表示命中</p><Balls :red="result.config.type === 'dan' ? row.pick.dan : row.pick.red" :blue="row.pick.blue" :actual="{red: row.actualRed, blue: row.actualBlue}" /><template v-if="result.config.type === 'dan'"><p>拖码</p><Balls :red="row.pick.tuo" :actual="{red: row.actualRed, blue: row.actualBlue}" /></template></div><div><p>实际开奖</p><Balls :red="row.actualRed" :blue="[row.actualBlue]" /><p>{{ row.counts.slice(1).map((count, index) => count ? `${GRADES[index + 1]} ${fmt(count)}注` : '').filter(Boolean).join(' · ') || '该期未中奖' }}</p><p v-if="row.unknown" class="error-text">浮动奖奖金字段缺失，金额暂未完整计算。</p></div></div></td></tr></template><tr v-if="!shown.length"><td colspan="6" class="empty">没有符合条件的开奖期。</td></tr></tbody></table></div><div class="pager"><span>共 {{ fmt(filtered.length) }}期 · {{ page + 1 }} / {{ pages }}页</span><div class="pager-buttons"><button class="secondary" :disabled="page === 0" @click="page--; detailIssue = null">上一页</button><button class="secondary" :disabled="page >= pages - 1" @click="page++; detailIssue = null">下一页</button></div></div></div><p class="result-footnote">{{ result.config.strategy === 'manual' ? '手动回看使用固定号码。' : '自动回测每期仅使用此前的数据；前500期作为初始历史。' }} 金额按记录与规则折算，未经逐期官方核验。数据截止 {{ draws.at(-1).date }}。</p>
      </div>
    </section></div></main>
</template>
