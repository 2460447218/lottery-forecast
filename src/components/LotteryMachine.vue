<script setup>
import {computed, onMounted, onBeforeUnmount, ref, watch} from 'vue';
import {pad} from '../utils.js';
const props = defineProps({pick: {type: Object, default: null}, running: Boolean, active: {type: Boolean, default: true}});
const emit = defineEmits(['complete']);
const root = ref(null), viewport = ref(null), revealed = ref(0), phase = ref('ready');
const loading = ref(true), unavailable = ref(false);
let scene, loadingScene, timer, token = 0, disposed = false;
const balls = computed(() => props.pick ? [...props.pick.red.map(number => ({number, kind: '红', blue: false})), ...props.pick.dan.map(number => ({number, kind: '胆', blue: false})), ...props.pick.tuo.map(number => ({number, kind: '拖', blue: false})), ...props.pick.blue.map(number => ({number, kind: '蓝', blue: true}))] : []);
const status = computed(() => props.running ? phase.value === 'mixing' ? '气流搅拌中' : `正在出球 ${revealed.value} / ${balls.value.length}` : balls.value.length ? '本组号码已就位' : '选择规则，开始摇号');
function fallback() {
  unavailable.value = true; loading.value = false;
  scene?.dispose(); scene = null;
  if (props.running) finish();
}
async function ensureScene() {
  if (scene || disposed || unavailable.value || !viewport.value) return;
  if (!loadingScene) loadingScene = import('../lottery-scene.js').then(({createLotteryScene}) => {
    if (disposed) return;
    scene = createLotteryScene(viewport.value, fallback);
    scene.setActive(props.active);
    loading.value = false;
  }).catch(fallback);
  return loadingScene;
}
function finish() {
  token++; clearTimeout(timer);
  scene?.setRunning(false);
  revealed.value = balls.value.length; phase.value = 'ready';
  if (props.running) emit('complete');
}
function extract(index, playToken) {
  if (!props.running || playToken !== token) return;
  if (index >= balls.value.length) {finish(); return;}
  phase.value = 'revealing';
  const duration = Math.min(540, 3200 / balls.value.length);
  scene?.eject(balls.value[index], duration / 1000);
  timer = setTimeout(() => {
    if (playToken !== token) return;
    revealed.value = index + 1;
    extract(index + 1, playToken);
  }, duration);
}
async function sync() {
  const playToken = ++token; clearTimeout(timer);
  if (!props.running) {scene?.setRunning(false); revealed.value = balls.value.length; phase.value = 'ready'; return;}
  revealed.value = 0; phase.value = 'mixing';
  await ensureScene();
  if (disposed || playToken !== token || !props.running) return;
  if (unavailable.value || matchMedia('(prefers-reduced-motion: reduce)').matches) {finish(); return;}
  scene?.reset(); scene?.setRunning(true);
  const bounds = root.value?.getBoundingClientRect();
  if (bounds && (bounds.top < 0 || bounds.top > innerHeight * .6)) root.value.scrollIntoView({behavior: 'smooth', block: 'start'});
  timer = setTimeout(() => extract(0, playToken), 1500);
}
watch(() => [props.running, props.pick], sync);
watch(() => props.active, async active => {
  if (active) await ensureScene();
  scene?.setActive(active);
});
onMounted(async () => {if (props.active) await ensureScene(); sync();});
onBeforeUnmount(() => {disposed = true; token++; clearTimeout(timer); scene?.dispose();});
</script>

<template>
  <section ref="root" class="lottery-machine" :class="{rolling: running}" :aria-busy="running">
    <div class="machine-heading"><div><span class="machine-eyebrow">THE DRAW ROOM</span><h3>双球仓 · 3D 摇奖机</h3></div><span class="machine-light" :class="{active: running}"><i></i>{{ running ? '摇号中' : '待机' }}</span></div>
    <div class="machine-view">
      <div ref="viewport" class="machine-scene" aria-label="三维玻璃球仓和金属摇奖机"></div>
      <div v-if="loading || unavailable" class="scene-placeholder">{{ unavailable ? '当前设备未启用3D加速，仍可正常生成号码' : '正在准备三维球仓…' }}</div>
      <div v-else class="scene-controls"><span>拖动查看机身</span><button type="button" @click="scene?.resetView()">复位视角</button></div>
      <div class="chamber-key" aria-hidden="true"><span><i class="red-dot"></i>红球仓 01—33</span><span><i class="blue-dot"></i>蓝球仓 01—16</span></div>
    </div>
    <div class="machine-output">
      <div class="machine-status"><span role="status" aria-live="polite"><i :class="{pulsing: running}"></i>{{ status }}</span><button v-if="running" type="button" @click="finish">跳过动画</button><span v-else class="machine-output-label">本次参考号码</span></div>
      <div class="machine-tray" aria-label="本次生成的号码"><template v-if="balls.length"><span v-for="(ball, index) in balls" :key="`${ball.kind}-${ball.number}-${index}`" class="machine-slot"><span v-if="index < revealed" class="drawn-ball" :class="{blue: ball.blue, arriving: running}"><b>{{ pad(ball.number) }}</b></span><span v-else class="empty-slot">{{ String(index + 1).padStart(2, '0') }}</span><small>{{ ball.kind }}</small></span></template><p v-else>设置好规则后，点击“生成参考号码”开始摇号。</p></div>
    </div>
    <p class="machine-note">动画展示所选规则的生成结果，不改变选号概率。</p>
  </section>
</template>

<style scoped>
.lottery-machine{overflow:hidden;margin:0 0 24px;border:1px solid #d4dfe4;border-radius:18px;background:#f8fafb;color:#193747;box-shadow:0 14px 36px #2944540c;scroll-margin-top:20px}.machine-heading{display:flex;justify-content:space-between;align-items:center;padding:24px 26px 16px;gap:12px}.machine-heading h3{font-size:21px;margin:6px 0 0;font-weight:600;letter-spacing:.5px}.machine-eyebrow{font:600 10px system-ui;letter-spacing:2.8px;color:#8899a1}.machine-light{display:flex;align-items:center;gap:7px;font-size:11px;border:1px solid #d7e2e6;background:#fff;border-radius:30px;padding:7px 11px;color:#768b96;white-space:nowrap}.machine-light i{width:6px;height:6px;border-radius:50%;background:#a6b6bf}.machine-light.active i{background:#16a487;box-shadow:0 0 0 4px #16a48715}.machine-light.active{color:#0a826d}.machine-view{position:relative;background:#e9eff1;border-top:1px solid #e1e8eb;border-bottom:1px solid #d9e3e7}.machine-scene{height:440px;width:100%;touch-action:pan-y}.machine-scene :deep(canvas){display:block;width:100%;height:100%;touch-action:pan-y!important}.scene-placeholder{position:absolute;inset:0;display:grid;place-items:center;text-align:center;font-size:13px;color:#718894;padding:24px}.scene-controls{position:absolute;right:18px;top:13px;display:flex;align-items:center;gap:12px;color:#7c929c;font-size:10px}.scene-controls button{font-size:10px;padding:5px 9px;background:#ffffffb3;border:1px solid #d3e0e5;border-radius:5px;color:#4e6b7a}.chamber-key{position:absolute;bottom:14px;left:0;right:0;display:flex;justify-content:center;gap:30px;font-size:11px;color:#55707d;pointer-events:none}.chamber-key span{display:flex;gap:7px;align-items:center}.chamber-key i{display:inline-block;width:7px;height:7px;border-radius:50%}.red-dot{background:#c3223c}.blue-dot{background:#2865ad}.machine-output{padding:20px 24px 14px;background:linear-gradient(180deg,#fff,#f4f8fa)}.machine-status{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:26px;font-size:12px;color:#476471}.machine-status>span:first-child{display:flex;align-items:center;gap:8px}.machine-status i{width:5px;height:5px;background:#128a80;border-radius:50%}.machine-status button{padding:5px 10px;border:1px solid #c8d9df;border-radius:6px;color:#395d6d;background:white;font-size:12px}.machine-output-label{font-size:10px;color:#93a4ad}.machine-tray{display:flex;justify-content:center;flex-wrap:wrap;gap:12px;padding:18px 0 0;min-height:84px}.machine-slot{text-align:center}.machine-slot small{display:block;font-size:10px;margin-top:8px;color:#8b9da6}.drawn-ball,.empty-slot{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;font:700 15px Arial}.drawn-ball{background:radial-gradient(circle at 30% 22%,#fc8394 0,#db2546 35%,#8e102e 90%);box-shadow:inset -3px -4px 7px #56071f50,inset 2px 2px 5px #fff5,0 5px 7px #3e172b24;border:1px solid #b61c3a}.drawn-ball b{display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:radial-gradient(circle at 30% 20%,#fff,#eae4d9);color:#2a3340;box-shadow:inset 0 -1px 2px #b5a99a77;font-size:14px}.drawn-ball.blue{background:radial-gradient(circle at 30% 22%,#8bbbea 0,#2468b1 38%,#123968 90%);border-color:#2b5890}.empty-slot{border:1px dashed #c9d7de;background:#edf3f6;color:#b1c1c9;font-size:11px}.machine-tray p{font-size:12px;margin:auto;color:#8296a1}.machine-note{font-size:10px;color:#8fa0aa;text-align:center;margin:0;padding:0 12px 18px;background:#f4f8fa}.arriving{animation:arrive .3s ease-out}.pulsing{animation:pulse .9s infinite}@keyframes arrive{from{opacity:0;transform:translateY(-15px) rotate(-35deg)}to{opacity:1;transform:translateY(0) rotate(0)}}@keyframes pulse{50%{opacity:.3}}@media(max-width:760px){.machine-heading{padding:18px 18px 14px}.machine-heading h3{font-size:18px}.machine-scene{height:340px}.machine-output{padding:16px 16px 12px}.machine-tray{gap:8px}.drawn-ball,.empty-slot{width:36px;height:36px}.drawn-ball b{width:24px;height:24px;font-size:12px}.machine-output-label{display:none}.chamber-key{font-size:10px;gap:18px}}@media(prefers-reduced-motion:reduce){.lottery-machine *{animation:none!important}}
</style>
