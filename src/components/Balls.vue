<script setup>
import {pad} from '../utils.js';
defineProps({red: {type: Array, default: () => []}, blue: {type: Array, default: () => []}, actual: {type: Object, default: null}, large: Boolean});
</script>

<template>
  <div class="balls">
    <span v-for="(number, index) in red" :key="`r-${index}`" class="ball" :class="{hit: actual?.red?.includes(number), large}">{{ pad(number) }}</span>
    <span v-if="red.length && blue.length" class="plus">+</span>
    <span v-for="(number, index) in blue" :key="`b-${index}`" class="ball blue" :class="{hit: actual?.blue === number, large}">{{ pad(number) }}</span>
  </div>
</template>
