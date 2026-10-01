<script setup>
import {computed, onMounted, reactive, ref, watch} from 'vue';
import {STRATEGIES, TOTAL, betLabel, predict} from '../engine.mjs';
import {fmt, money, pad, freshSeed} from '../utils.js';
import Balls from './Balls.vue';
import LotteryMachine from './LotteryMachine.vue';
import {predictBirthdays, predictBirthdayMix} from '../birthday.mjs';

const props = defineProps({draws: {type: Array, required: true}, active: {type: Boolean, default: true}});
const emit = defineEmits(['error', 'use-prediction']);
const config = reactive({strategy: location.hash === '#birthday' ? 'birthday' : 'hot100', type: 'pool', redCount: 6, blueCount: 2, danCount: 4, tuoCount: 5, seed: 20260930});
const result = ref(null);
const pendingResult = ref(null);
const rolling = ref(false);
function finishRoll() {
  if (pendingResult.value) result.value = pendingResult.value;
  pendingResult.value = null;
  rolling.value = false;
}
watch(() => props.active, active => {if (!active && rolling.value) finishRoll();});
const copied = ref(false);
let nextBirthdayId = 2;
const birthdays = ref([{id: 1, name: '', date: ''}]);
const birthdayMode = ref('mixed');
const birthdayRedCount = ref(3);
const sourceDetail = ref(null);
const redCapacity = computed(() => config.type === 'dan' ? Number(config.danCount) + Number(config.tuoCount) : Number(config.redCount));
watch(redCapacity, limit => {if (Number.isInteger(limit) && limit > 0 && birthdayRedCount.value > limit) birthdayRedCount.value = limit;});
watch(() => JSON.stringify([birthdays.value, birthdayMode.value, birthdayRedCount.value, config.type, config.redCount, config.blueCount, config.danCount, config.tuoCount]), () => {
  if (config.strategy === 'birthday') {result.value = null; sourceDetail.value = null; copied.value = false;}
});
const today = new Date().toLocaleDateString('sv-SE');
const strategyOptions = [...Object.entries(STRATEGIES).filter(([key]) => key !== 'manual'), ['birthday', '亲人生日组合']];
const selectedReds = computed(() => result.value?.config.type === 'dan' ? [...result.value.pick.dan, ...result.value.pick.tuo] : result.value?.pick.red ?? []);
const statsRows = computed(() => result.value ? [...selectedReds.value.map(n => ({color: 'red', n, stat: result.value.stats.red[n - 1]})), ...result.value.pick.blue.map(n => ({color: 'blue', n, stat: result.value.stats.blue[n - 1]}))] : []);

function generate(animate = true) {
  if (rolling.value) return;
  try {
    let generated;
    const input = {...config};
    if (input.strategy === 'random') config.seed = input.seed = freshSeed();
    if (input.strategy === 'birthday') {
      generated = birthdayMode.value === 'mixed'
        ? predictBirthdayMix(props.draws, input, birthdays.value, {birthdayRedCount: birthdayRedCount.value, round: result.value?.mixed ? result.value.round + 1 : 0, seed: freshSeed()})
        : predictBirthdays(props.draws, input, birthdays.value.map(person => person.date));
    } else generated = predict(props.draws, input);
    if (animate) {pendingResult.value = generated; rolling.value = true;}
    else result.value = generated;
    sourceDetail.value = null;
    copied.value = false;
    emit('error', '');
  } catch (error) {emit('error', error.message);}
}
async function copyNumbers() {
  if (!result.value) return;
  const p = result.value.pick;
  const text = result.value.config.type === 'dan' ? `胆码：${p.dan.map(pad).join(' ')}；拖码：${p.tuo.map(pad).join(' ')}；蓝球：${p.blue.map(pad).join(' ')}` : `红球：${p.red.map(pad).join(' ')}；蓝球：${p.blue.map(pad).join(' ')}`;
  try {await navigator.clipboard.writeText(text); copied.value = true;} catch {emit('error', '浏览器未允许复制，请直接选中号码复制。');}
}
function openBirthday() {pendingResult.value = null; rolling.value = false; config.strategy = 'birthday'; result.value = null;}
defineExpose({openBirthday});
onMounted(() => {if (config.strategy !== 'birthday') generate(false);});
</script>

<template>
  <main id="prediction" class="tab-panel"><div class="prediction-layout"><aside class="config card"><div class="section-kicker"><span>01</span> 生成下一期参考</div><h2>选择生成规则</h2><form @submit.prevent="generate()"><fieldset class="prediction-fields" :disabled="rolling"><label for="pred-strategy">选号规则</label><select id="pred-strategy" v-model="config.strategy"><option v-for="[key, label] in strategyOptions" :key="key" :value="key">{{ label }}</option></select><div v-if="config.strategy === 'birthday'" class="birthday-editor"><h3>亲人生日</h3><p class="field-help">填写公历生日，可添加多位亲人。仅在当前页面内使用，不上传或保存。</p><fieldset v-for="(person, index) in birthdays" :key="person.id" class="birthday-row"><legend>亲人 {{ index + 1 }}</legend><label :for="`birthday-name-${person.id}`">称呼（选填）</label><input :id="`birthday-name-${person.id}`" v-model="person.name" maxlength="20" placeholder="如：妈妈" /><label :for="`birthday-date-${person.id}`">公历生日</label><input :id="`birthday-date-${person.id}`" v-model="person.date" type="date" min="1900-01-01" :max="today" required /><button type="button" class="tiny-button" :disabled="birthdays.length === 1" :aria-label="`移除亲人${index + 1}`" @click="birthdays.splice(index, 1)">移除</button></fieldset><button type="button" class="secondary" :disabled="birthdays.length >= 30" @click="birthdays.push({id: nextBirthdayId++, name: '', date: ''})">＋ 添加亲人</button><label for="birthday-mode">生日组合方式</label><select id="birthday-mode" v-model="birthdayMode"><option value="mixed">每人优先留号＋随机补齐</option><option value="classic">原版：全部按生日组合</option></select>
<div v-if="birthdayMode === 'mixed'"><label for="birthday-red-count">生日红球名额</label><input id="birthday-red-count" v-model.number="birthdayRedCount" type="number" min="1" :max="redCapacity" required /><p class="field-help">在{{ redCapacity }}个红球中预留{{ birthdayRedCount || '—' }}个生日号，其余随机补齐。优先让每份不同生日贡献一个不重复的号码；名额不足时，点“换一组”轮换亲人。相同生日合并参与。蓝球保留1个生日号，其余随机补齐。</p></div>
<p v-else class="field-help">优先取各生日的月份、日期，再用年份后两位、月日相加等组合补充。超出范围的数字循环映射到红球1—33、蓝球1—16。相同生日和设置会得到相同结果，重复生日按一份计算。</p></div><label for="pred-type">投注方式</label><select id="pred-type" v-model="config.type"><option value="pool">单式 / 复式</option><option value="dan">红球胆拖</option></select><div class="two-col"><div v-if="config.type === 'pool'"><label for="pred-red">红球个数</label><input id="pred-red" v-model.number="config.redCount" type="number" min="6" max="33" required /></div><div><label for="pred-blue">蓝球个数</label><input id="pred-blue" v-model.number="config.blueCount" type="number" min="1" max="16" required /></div></div><div v-if="config.type === 'dan'" class="two-col"><div><label for="pred-dan">胆码</label><input id="pred-dan" v-model.number="config.danCount" type="number" min="1" max="5" /></div><div><label for="pred-tuo">拖码</label><input id="pred-tuo" v-model.number="config.tuoCount" type="number" min="2" max="29" /></div></div><template v-if="config.strategy === 'random'"><label for="pred-seed">随机种子</label><input id="pred-seed" v-model.number="config.seed" type="number" min="1" max="4294967295" /></template><p class="field-help">使用截至 {{ draws.at(-1).issue }} 期的全部可用历史。不会自动获取未来开奖。</p><button class="primary" type="submit" style="margin-top:22px">{{ rolling ? '正在摇号…' : '生成参考号码' }}</button></fieldset></form></aside>
    <section><div class="notice-banner">这是规则生成的下一期参考，不是更高中奖概率的承诺。热门、冷门和遗漏不改变公平独立开奖下单注的概率。</div>
      <LotteryMachine :pick="pendingResult?.pick || result?.pick" :running="rolling" @complete="finishRoll" /><template v-if="result && !rolling"><div class="card reference-card"><span class="label-chip">截至 {{ result.lastIssue }} 期 · {{ result.date }}</span><p class="eyebrow">NEXT DRAW / REFERENCE ONLY</p><h2>{{ result.label || STRATEGIES[result.config.strategy] }} · {{ betLabel(result.config) }}</h2><template v-if="result.config.type === 'dan'"><p class="field-help" style="margin-bottom:10px">胆码</p><Balls :red="result.pick.dan" :sources="result.sources" @source="sourceDetail = $event" large /><p class="field-help" style="margin-bottom:10px">拖码与蓝球</p><Balls :red="result.pick.tuo" :blue="result.pick.blue" :sources="result.sources" @source="sourceDetail = $event" large /></template><Balls v-else :red="result.pick.red" :blue="result.pick.blue" :sources="result.sources" @source="sourceDetail = $event" large /><div v-if="result.sources" class="number-source" aria-live="polite"><span v-if="!sourceDetail">点击任意号码查看来源，下方表格也列出了全部来源。</span><template v-else><strong>{{ sourceDetail.color }} {{ pad(sourceDetail.number) }}</strong><span>{{ sourceDetail.text }}</span></template></div>
<div v-if="result.mixed" class="family-combination-info"><p><strong>第 {{ result.round + 1 }} 组</strong> · {{ result.birthdayRedCount }}个生日红球＋{{ result.randomRedCount }}个随机红球</p><p>本组生日红球来自：{{ result.participating.join('、') }}。</p><p v-if="result.waiting.length">本组未分配独立生日红球：{{ result.waiting.join('、') }}。名额少于生日数时，换一组会轮换优先顺序；候选号码重合也可能影响分配。</p><p v-if="result.birthdayRedCount < result.requestedBirthdayRedCount">生日候选号码去重后不足，缺少的名额已随机补齐。</p><p>蓝球保留1个生日号，换组时轮换亲人；其他蓝球随机补齐。随机号码也可能与上组重复。</p></div>
<div class="reference-sub"><div>组合数<strong>{{ fmt(result.tickets) }} <small>注</small></strong></div><div>对应成本<strong>{{ money(result.tickets * 2) }}</strong></div><div>一等奖理论概率<strong style="font-size:19px">约 {{ fmt(Math.round(TOTAL / result.tickets)) }} 分之一</strong></div></div><p class="field-help">{{ result.birthday ? `由${result.birthdayCount}位亲人的生日生成的纪念号码，不代表更高中奖概率。` : '这只是历史统计规则。' }} {{ result.mixed ? '胆拖时先将生日红球列入候选顺序，按胆码个数依次分配，其余作拖码。' : '胆拖规则取排名最前的号码作胆码，其余作拖码。' }}</p><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px"><button v-if="result.mixed" class="secondary" @click="generate()">换一组</button><button class="secondary" @click="copyNumbers">{{ copied ? '已复制' : '复制号码' }}</button><button v-if="!result.birthday" class="secondary" @click="emit('use-prediction', result, false)">回测这套规则</button><button class="secondary" @click="emit('use-prediction', result, true)">固定号码历史回看</button></div></div>
        <div class="card table-card"><div class="card-heading"><div><h3>这些号码的历史表现</h3><p>统计依据，不是下一期概率评分。</p></div></div><div class="table-wrap"><table><thead><tr><th>号码</th><th>用途</th><th v-if="result.sources">号码来源</th><th>近100期</th><th>近30期</th><th>当前遗漏</th></tr></thead><tbody><tr v-for="row in statsRows" :key="`${row.color}-${row.n}`"><td><Balls :red="row.color === 'red' ? [row.n] : []" :blue="row.color === 'blue' ? [row.n] : []" /></td><td>{{ row.color === 'blue' ? '蓝球' : result.pick.dan.includes(row.n) ? '胆码' : result.config.type === 'dan' ? '拖码' : '红球' }}</td><td v-if="result.sources" class="source-table-cell">{{ result.sources[row.color][row.n].text }}</td><td class="num">{{ row.stat.last100 }}次</td><td class="num">{{ row.stat.last30 }}次</td><td class="num">{{ row.stat.omission }}期</td></tr></tbody></table></div></div></template>
    </section></div></main>
</template>
