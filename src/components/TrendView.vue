<script setup>
import {computed, ref, watch} from 'vue';
import Balls from './Balls.vue';
import {trendModel, ticketCount} from '../trend.mjs';
import '../trend.css';
const props=defineProps({draws:{type:Array,required:true}});
const emit=defineEmits(['backtest']);
const pad=n=>String(n).padStart(2,'0');
const columns=Array.from({length:49},(_,j)=>({j,key:j<33?'red':'blue',n:j<33?j+1:j-32}));
const end=ref(props.draws.length),count=ref(50),omissions=ref(true),lines=ref(true),active=ref(0),status=ref('');
let saved;
try{saved=JSON.parse(localStorage.getItem('ssq-trend-picks-v1'));}catch{}
const valid=Array.isArray(saved)&&saved.length>0&&saved.length<=20&&saved.every(p=>p&&['red','blue'].every(k=>Array.isArray(p[k])&&new Set(p[k]).size===p[k].length&&p[k].every(v=>Number.isInteger(v)&&v>=1&&v<=(k==='red'?33:16))));
const picks=ref(valid?saved:[{red:[],blue:[]},{red:[],blue:[]},{red:[],blue:[]}]);
watch(picks,p=>{try{localStorage.setItem('ssq-trend-picks-v1',JSON.stringify(p));}catch{status.value='浏览器无法保存草稿，本次仍可继续选号。';}},{deep:true});
const model=computed(()=>trendModel(props.draws,end.value,count.value));
const current=computed(()=>picks.value[active.value]);
const tickets=computed(()=>ticketCount(current.value));
const points=computed(()=>model.value.rows.map((r,i)=>`${(r.blue-.5)*36},${i*34+17}`).join(' '));
const statRows=[['出现次数','count'],['当前遗漏','current'],['最大遗漏','maxMiss'],['最大连出','longest']];
function pick(i,c){active.value=i;const p=current.value;p[c.key]=p[c.key].includes(c.n)?p[c.key].filter(n=>n!==c.n):[...p[c.key],c.n].sort((a,b)=>a-b);status.value='';}
function add(){if(picks.value.length===20){status.value='最多保留20行，请先删除不需要的行。';return;}picks.value.push({red:[],blue:[]});active.value=picks.value.length-1;}
function remove(){picks.value.splice(active.value,1);if(!picks.value.length)picks.value.push({red:[],blue:[]});active.value=Math.min(active.value,picks.value.length-1);}
function clear(){picks.value[active.value]={red:[],blue:[]};status.value='';}
function randomBelow(n){const a=new Uint32Array(1),limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%n;}
function random(){const pool=Array.from({length:33},(_,i)=>i+1);for(let i=32;i>0;i--){const j=randomBelow(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}picks.value[active.value]={red:pool.slice(0,6).sort((a,b)=>a-b),blue:[randomBelow(16)+1]};status.value='';}
function ready(){if(tickets.value)return true;status.value='请先选满至少6个红球和1个蓝球。';return false;}
async function copy(){if(!ready())return;const p=current.value,text=`红球：${p.red.map(pad).join(' ')}；蓝球：${p.blue.map(pad).join(' ')}`;try{await navigator.clipboard.writeText(text);status.value='当前行号码已复制。';}catch{status.value=`复制未获浏览器允许，请选中以下文字复制：${text}`;}}
function backtest(){if(ready())emit('backtest',{pick:{red:[...current.value.red],blue:[...current.value.blue],dan:[],tuo:[]},end:end.value});}
function zones(red){return [0,1,2].map(z=>red.filter(n=>n>z*11&&n<=(z+1)*11).length).join(':');}
</script>
<template>
<main id="trend" class="tab-panel">
 <div class="trend-heading"><div><p class="eyebrow">TREND / PICK / VERIFY</p><h2>基本走势与自由选号</h2><p class="field-help">沿着历史看分布，在下方直接选号，再用回测验证。</p></div><span class="label-chip">最近同步 · 截止 {{ draws.at(-1).issue }} 期</span></div>
 <div class="trend-tools card"><label>显示期数<select id="trend-count" v-model.number="count"><option :value="30">近30期</option><option :value="50">近50期</option><option :value="100">近100期</option></select></label><label>截止期号<select id="trend-end" v-model.number="end"><option v-for="(d,i) in [...draws].reverse()" :key="d.issue" :value="draws.length-i">{{ d.issue }} · {{ d.date }}</option></select></label><label class="trend-check"><input v-model="omissions" type="checkbox">遗漏数字</label><label class="trend-check"><input v-model="lines" type="checkbox">蓝球连线</label><button class="secondary" @click="end=draws.length">回到最新</button></div>
 <p id="trend-range" class="field-help">{{ model.rows[0].issue }} — {{ model.rows.at(-1).issue }} · 共 {{ model.rows.length }} 期 · 红球 01–11 / 12–22 / 23–33 三区 · 左右滑动查看完整表格</p>
 <div class="trend-scroll card" tabindex="0" aria-label="双色球走势表，可横向滚动">
  <div class="tg-zones"><span>历史开奖</span><span>一区 · 01–11</span><span>二区 · 12–22</span><span>三区 · 23–33</span><span>蓝球 · 01–16</span><span>红球形态</span></div>
  <div class="tg-row tg-head"><span class="tg-issue">期号 / 日期</span><span v-for="c in columns" :key="c.j" :class="'tg-'+c.key">{{ pad(c.n) }}</span><span>和值</span><span>跨度</span><span>区间比</span><span>奇偶比</span></div>
  <div class="tg-body"><div v-for="d in model.rows" :key="d.issue" class="tg-row"><span class="tg-issue" :title="d.date">{{ d.issue }}<small>{{ d.date.slice(5) }}</small></span><span v-for="c in columns" :key="c.j" class="tg-cell" :class="['tg-'+c.key,{'tg-divider':[11,22,33].includes(c.j)}]"><b v-if="d.hits[c.j]" class="tg-hit">{{ pad(c.n) }}</b><template v-else-if="omissions">{{ d.known[c.j]?'':'≥' }}{{ d.miss[c.j] }}</template></span><span>{{ d.red.reduce((a,b)=>a+b,0) }}</span><span>{{ Math.max(...d.red)-Math.min(...d.red) }}</span><span>{{ zones(d.red) }}</span><span>{{ d.red.filter(n=>n%2).length }}:{{ d.red.filter(n=>!(n%2)).length }}</span></div><svg v-if="lines" class="tg-lines" width="576" :height="model.rows.length*34" aria-hidden="true"><polyline :points="points" fill="none" stroke="#2776b5" stroke-width="1.5" opacity=".65"/></svg></div>
  <div id="trend-pick-rows"><div v-for="(p,i) in picks" :key="i" class="tg-row tg-pick" :class="{'is-active':i===active}"><button class="tg-issue" :aria-pressed="i===active" @click="active=i">{{ i===active?'●':'○' }} 选号行 {{ i+1 }}</button><button v-for="c in columns" :key="c.j" class="tg-pick-ball" :class="[c.key,{selected:p[c.key].includes(c.n)}]" :aria-label="`选号行${i+1} ${c.key==='red'?'红球':'蓝球'}${pad(c.n)}`" :aria-pressed="p[c.key].includes(c.n)" @click="pick(i,c)">{{ pad(c.n) }}</button><span class="tg-stat-note">{{ p.red.length }}红 + {{ p.blue.length }}蓝</span></div></div>
  <div v-for="[label,key] in statRows" :key="key" class="tg-row tg-stat"><span class="tg-issue">{{ label }}</span><span v-for="(s,j) in model.stats" :key="j">{{ s[key] }}</span><span class="tg-stat-note">{{ key==='count'?'当前显示区间':'' }}</span></div>
 </div>
 <div class="trend-actions"><button class="secondary" @click="add">＋ 添加选号行</button><button class="secondary" @click="remove">删除当前行</button><button class="secondary" @click="clear">清空当前行</button><button class="secondary" @click="random">随机一注</button><button class="secondary" @click="copy">复制当前行</button><button class="primary" @click="backtest">用当前行回测</button></div>
 <div id="trend-selection" class="card trend-selection"><div><strong>选号行 {{ active+1 }}</strong><p class="field-help">{{ current.red.length }} 个红球 · {{ current.blue.length }} 个蓝球 · {{ tickets ? `${tickets.toLocaleString()} 注 · ¥${(tickets*2).toLocaleString()}`:'至少选择6红 + 1蓝' }}</p></div><Balls :red="current.red" :blue="current.blue" /></div>
 <p id="trend-status" role="status" aria-live="polite">{{ status }}</p><p class="field-help">统计范围为当前显示期数；遗漏从内置历史首期累计，“≥”表示此前是否出现未知。最大遗漏为显示区间内记录到的最大值。选号草稿保存在当前浏览器，最多20行。历史走势不代表下一期概率。</p>
</main>
</template>
