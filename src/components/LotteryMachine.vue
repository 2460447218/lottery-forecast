<script setup>
import {computed, onBeforeUnmount, ref, watch} from 'vue';
import {pad} from '../utils.js';
const props = defineProps({pick: {type: Object, default: null}, running: Boolean});
const emit = defineEmits(['complete']);
const revealed = ref(0), phase = ref('ready');
let timer;
const balls = computed(() => props.pick ? [...props.pick.red.map(number => ({number, kind: '红', blue: false})), ...props.pick.dan.map(number => ({number, kind: '胆', blue: false})), ...props.pick.tuo.map(number => ({number, kind: '拖', blue: false})), ...props.pick.blue.map(number => ({number, kind: '蓝', blue: true}))] : []);
const status = computed(() => props.running ? phase.value === 'mixing' ? '球仓搅拌中…' : `正在出球 ${revealed.value} / ${balls.value.length}` : balls.value.length ? '本组号码已就位' : '选择规则，开始摇号');
function finish() {clearTimeout(timer); revealed.value = balls.value.length; phase.value = 'ready'; if (props.running) emit('complete');}
function revealNext() {
  if (!props.running) return;
  phase.value = 'revealing'; revealed.value++;
  if (revealed.value >= balls.value.length) timer = setTimeout(finish, 250);
  else timer = setTimeout(revealNext, Math.min(230, 2300 / balls.value.length));
}
watch(() => [props.running, props.pick], () => {
  clearTimeout(timer);
  if (!props.running) {revealed.value = balls.value.length; phase.value = 'ready'; return;}
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {finish(); return;}
  revealed.value = 0; phase.value = 'mixing'; timer = setTimeout(revealNext, 1000);
}, {immediate: true});
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="lottery-machine" :class="{rolling: running}" :aria-busy="running">
    <div class="machine-heading"><div><span class="machine-eyebrow">NUMBER STUDIO</span><h3>你的专属摇号机</h3></div><span class="machine-light" :class="{active: running}">{{ running ? '运行中' : '已就绪' }}</span></div>
    <div class="machine-stage" aria-hidden="true"><div class="machine-globe"><div class="globe-hoop"></div><div class="globe-shine"></div><span v-for="n in 16" :key="n" class="mixing-orbit" :style="{'--i': n, '--x': `${20 + (n * 37 % 62)}%`, '--y': `${20 + (n * 23 % 63)}%`}"><i class="mixing-ball" :class="{blue: n > 12}">{{ pad(n) }}</i></span></div><div class="machine-neck"></div><div class="machine-base"><span>双色球 · 参考号码</span><i></i><i></i><i></i></div></div>
    <div class="machine-status"><span role="status" aria-live="polite">{{ status }}</span><button v-if="running" type="button" @click="finish">跳过动画</button></div>
    <div class="machine-tray" aria-label="本次生成的号码"><template v-if="balls.length"><span v-for="(ball, index) in balls" :key="`${ball.kind}-${ball.number}-${index}`" class="machine-slot"><span v-if="index < revealed" class="drawn-ball" :class="{blue: ball.blue, arriving: running}">{{ pad(ball.number) }}</span><span v-else class="empty-slot">·</span><small>{{ ball.kind }}</small></span></template><p v-else>生成参考号码后，球仓会滚动并逐个出球。</p></div>
    <p class="machine-note">按所选规则展示生成结果，动画不改变选号概率。</p>
  </div>
</template>

<style scoped>
.lottery-machine{overflow:hidden;padding:24px;margin:0 0 22px;border-radius:14px;color:#e7f3f5;background:radial-gradient(ellipse at 50% 35%,#245b66 0%,#153b48 42%,#102b38 100%);box-shadow:0 12px 32px #183f4b18}.machine-heading{display:flex;justify-content:space-between;align-items:center;gap:12px}.machine-heading h3{color:#fff;margin:5px 0;font-size:20px}.machine-eyebrow{font-size:10px;letter-spacing:2.5px;color:#a3cbd0}.machine-light{font-size:11px;background:#ffffff0d;border:1px solid #ffffff25;border-radius:20px;padding:6px 10px}.machine-light:before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:#9bb8c2;margin-right:6px}.machine-light.active:before{background:#79ebc3;box-shadow:0 0 9px #79ebc3}.machine-stage{width:230px;margin:20px auto 8px;position:relative}.machine-globe{width:194px;height:194px;margin:auto;border-radius:50%;border:3px solid #94cad06b;position:relative;overflow:hidden;background:radial-gradient(circle at 35% 25%,#c0e5ec30,#163c494d 60%,#0a2839a1);box-shadow:inset 0 0 30px #a6d5dd25,0 0 30px #81c9da14}.globe-shine{position:absolute;inset:10px;border-radius:50%;border-top:6px solid #ffffff3d;transform:rotate(-32deg);pointer-events:none;z-index:2}.globe-hoop{position:absolute;inset:4px 28px;border:1px solid #c6e7eb30;border-radius:50%;transform:rotate(-28deg)}.mixing-orbit{position:absolute;left:var(--x);top:var(--y);margin:-12px;width:25px;height:25px}.mixing-ball{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;font:bold 10px system-ui;color:#a93548;background:radial-gradient(circle at 32% 25%,#fff,#ffc8cf 65%,#dc7386);box-shadow:2px 3px 5px #061b3640;font-style:normal}.mixing-ball.blue{background:radial-gradient(circle at 32% 25%,#fff,#b3d9ff 65%,#507eca);color:#224b94}.rolling .globe-hoop{animation:hoop-spin 1.3s linear infinite}.rolling .mixing-orbit{animation:ball-tumble calc(.7s + var(--i)*.027s) ease-in-out infinite alternate;animation-delay:calc(var(--i)*-.13s)}.machine-neck{height:14px;width:35px;margin:-2px auto 0;background:linear-gradient(90deg,#4f8491,#a6ccd1,#3c7482);border-radius:0 0 6px 6px}.machine-base{height:33px;border-radius:10px 10px 6px 6px;display:flex;gap:4px;align-items:center;padding:0 14px;background:linear-gradient(#3b6e7e,#254e60);border:1px solid #ffffff20;box-shadow:0 8px 15px #03192755}.machine-base span{font-size:10px;margin-right:auto;color:#d6edf0}.machine-base i{width:4px;height:4px;background:#77c0c2;border-radius:50%}.machine-status{display:flex;justify-content:center;align-items:center;gap:16px;font-size:12px;min-height:36px;color:#cbe5e7}.machine-status button{background:transparent;border:1px solid #aacfd34d;color:#e4f5f6;padding:5px 10px;border-radius:6px;font-size:12px}.machine-tray{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;padding:16px 10px 10px;border-radius:10px;border:1px solid #c4e5eb22;background:#071c2a66;min-height:78px}.machine-slot{text-align:center}.machine-slot small{display:block;font-size:9px;margin-top:6px;color:#aac6d0}.drawn-ball,.empty-slot{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;font:700 15px system-ui}.drawn-ball{background:radial-gradient(circle at 32% 22%,#fff7f8,#ffd5dc 52%,#dd8494);color:#a83147;box-shadow:0 4px 8px #0005,inset -2px -3px 5px #b92b4b20}.drawn-ball.blue{background:radial-gradient(circle at 32% 22%,#fff,#c5e3ff 52%,#719cd8);color:#2254a1}.empty-slot{border:1px dashed #aacbd04d;color:#537a88}.arriving{animation:ball-arrive .32s ease-out}.machine-tray p{font-size:12px;color:#aecbd2;margin:auto}.machine-note{font-size:10px;text-align:center;color:#9bbdc6;margin:12px 0 0}@keyframes ball-tumble{0%{transform:translate(-23px,24px) rotate(-120deg)}50%{transform:translate(16px,-36px) rotate(50deg)}100%{transform:translate(28px,22px) rotate(200deg)}}@keyframes hoop-spin{to{transform:rotate(332deg)}}@keyframes ball-arrive{from{opacity:0;transform:translateY(-18px) scale(.65)}to{opacity:1;transform:translateY(0) scale(1)}}@media(max-width:760px){.lottery-machine{padding:18px}.machine-heading h3{font-size:18px}.machine-tray{gap:8px}.drawn-ball,.empty-slot{width:33px;height:33px;font-size:14px}}@media(prefers-reduced-motion:reduce){.lottery-machine *{animation:none!important}}
</style>
