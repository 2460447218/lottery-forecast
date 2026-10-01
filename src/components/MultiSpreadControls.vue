<script setup>
defineProps({maxOverlap:Number,blueMode:String});
const emit=defineEmits(['update:maxOverlap','update:blueMode']);
</script>
<template>
 <div class="spread-controls"><label for="multi-overlap">任意两注最多重复几个红球</label><select id="multi-overlap" :value="maxOverlap" @change="emit('update:maxOverlap',Number($event.target.value))"><option :value="5">5个 · 普通组号，仅排除完全重复</option><option :value="4">4个 · 适度分散</option><option :value="3">3个 · 分散组号</option><option :value="2">2个 · 更少重叠，需要较大球池</option></select><label for="multi-blue-mode">蓝球分配</label><select id="multi-blue-mode" :value="blueMode" @change="emit('update:blueMode',$event.target.value)"><option value="random">允许重复 · 每注随机</option><option value="balanced">优先分散 · 用完一轮再重复</option></select><p class="field-help">分散模式会拒绝超过重复上限的组合，蓝球优先选当前使用次数最少的号码。条件过紧时会提示调整，不会偷偷放宽上限。运行时自动测试同一设置的100个随机编号。</p></div>
</template>
