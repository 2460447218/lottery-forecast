<script setup>
import {pad} from '../utils.js';
defineProps({red: {type: Array, default: () => []}, blue: {type: Array, default: () => []}, actual: {type: Object, default: null}, sources: {type: Object, default: null}, large: Boolean});
const emit = defineEmits(['source']);
</script>

<template>
  <div class="balls">
    <template v-for="(number, index) in red" :key="`r-${index}`">
      <button v-if="sources?.red?.[number]" type="button" class="ball source-ball" :class="{large}" :aria-label="`红球${pad(number)}，查看来源：${sources.red[number].text}`" :title="sources.red[number].text" @click="emit('source', {color: '红球', number, text: sources.red[number].text})">{{ pad(number) }}</button>
      <span v-else class="ball" :class="{hit: actual?.red?.includes(number), large}">{{ pad(number) }}</span>
    </template>
    <span v-if="red.length && blue.length" class="plus">+</span>
    <template v-for="(number, index) in blue" :key="`b-${index}`">
      <button v-if="sources?.blue?.[number]" type="button" class="ball blue source-ball" :class="{large}" :aria-label="`蓝球${pad(number)}，查看来源：${sources.blue[number].text}`" :title="sources.blue[number].text" @click="emit('source', {color: '蓝球', number, text: sources.blue[number].text})">{{ pad(number) }}</button>
      <span v-else class="ball blue" :class="{hit: actual?.blue === number, large}">{{ pad(number) }}</span>
    </template>
  </div>
</template>
