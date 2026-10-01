<script setup>
import {onMounted, onBeforeUnmount, ref, watch} from 'vue';
import {init, use} from 'echarts/core';
import {LineChart, BarChart} from 'echarts/charts';
import {GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, AriaComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';
use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, AriaComponent, CanvasRenderer]);
const props = defineProps({option: {type: Object, required: true}, selected: {type: Number, default: -1}, label: {type: String, required: true}, short: Boolean});
const emit = defineEmits(['select']);
const host = ref(null);
let chart, observer;
function resize() {
  if (!host.value?.clientWidth) return;
  if (!chart) {
    chart = init(host.value);
    chart.setOption(props.option);
    chart.on('updateAxisPointer', event => {
      const axis = event.axesInfo?.find(item => item.axisDim === 'x');
      if (axis && props.option.xAxis?.type === 'category') {
        const value = Number(axis.value);
        if (Number.isInteger(value) && value >= 0 && value < props.option.xAxis.data.length) emit('select', value);
      }
    });
    chart.on('click', event => {if (props.option.xAxis?.type === 'category') emit('select', event.dataIndex);});
  } else chart.resize();
}
watch(() => props.option, option => {
  if (chart) chart.setOption(option, {notMerge: true});
  else resize();
});
watch(() => props.selected, index => {
  if (chart && index >= 0) chart.dispatchAction({type: 'showTip', seriesIndex: 0, dataIndex: index});
});
onMounted(() => {observer = new ResizeObserver(resize); observer.observe(host.value); resize();});
onBeforeUnmount(() => {observer?.disconnect(); chart?.dispose(); chart = null;});
</script>

<template><div ref="host" class="echart" :class="{'echart-short': short}" role="img" :aria-label="label"></div></template>

<style scoped>
.echart{width:100%;height:340px;min-width:0}.echart-short{height:280px}
@media(max-width:760px){.echart{height:300px}.echart-short{height:260px}}
</style>
