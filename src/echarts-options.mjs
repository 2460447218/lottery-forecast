import {GRADES} from './engine.mjs';

const currency = value => `¥${Number(value).toLocaleString('zh-CN')}`;
const compact = value => Math.abs(value) >= 10000 ? `${(value / 10000).toFixed(1)}万` : String(value);
export function chartRows(records, mode) {
  if (!records.length) throw new Error('图表需要逐期数据。');
  if (!['cumulative', 'recent'].includes(mode)) throw new Error('未知图表模式。');
  return mode === 'recent' ? records.slice(-30) : records;
}
export function backtestOptions(records, mode = 'cumulative', animate = true) {
  const rows = chartRows(records, mode), recent = mode === 'recent';
  return {
    animation: animate, animationDuration: 600, animationDurationUpdate: 250,
    textStyle: {fontFamily: 'system-ui, sans-serif', color: '#617783'},
    aria: {enabled: true},
    grid: {left: 64, right: 20, top: 52, bottom: 82},
    legend: recent ? {show: false} : {top: 8, right: 12, data: ['累计投入', '累计已知奖金']},
    tooltip: {trigger: 'axis', confine: true, renderMode: 'richText', axisPointer: {type: recent ? 'shadow' : 'line'}, formatter(params) {
      const row = rows[params[0]?.dataIndex];
      if (!row) return '';
      return `${row.issue}期 · ${row.date}\n${recent ? `当期投入：${currency(row.cost)}\n当期已知奖金：${currency(row.payout)}\n当期已知净额：${currency(row.net)}` : `累计投入：${currency(row.cumulativeCost)}\n累计已知奖金：${currency(row.cumulativePrize)}`}${row.unknown ? '\n该期浮动奖金缺失，金额为已知下限' : ''}`;
    }},
    xAxis: {type: 'category', boundaryGap: recent, data: rows.map(row => row.issue), axisTick: {show: false}, axisLine: {lineStyle: {color: '#d8e4e8'}}, axisLabel: {color: '#617783', hideOverlap: true}},
    yAxis: {type: 'value', name: '金额 / 元', axisLabel: {formatter: compact}, splitLine: {lineStyle: {color: '#e9eff2', type: 'dashed'}}},
    dataZoom: [{type: 'inside', zoomOnMouseWheel: false}, {type: 'slider', height: 22, bottom: 12, borderColor: '#d8e4e8', fillerColor: 'rgba(18,138,128,.12)', dataBackground: {lineStyle: {color: '#aac8cc'}, areaStyle: {color: '#e8f1f3'}}, selectedDataBackground: {lineStyle: {color: '#128a80'}, areaStyle: {color: '#cce5e2'}}, handleStyle: {color: '#128a80'}}],
    series: recent ? [{name: '当期已知净额', type: 'bar', barMaxWidth: 28, data: rows.map(row => ({value: row.net, itemStyle: {color: row.net >= 0 ? '#128a80' : '#d35d63', borderRadius: row.net >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4]}}))}]
      : [{name: '累计投入', type: 'line', showSymbol: false, lineStyle: {width: 2, type: 'dashed'}, itemStyle: {color: '#91a6b2'}, data: rows.map(row => row.cumulativeCost)},
        {name: '累计已知奖金', type: 'line', showSymbol: false, lineStyle: {width: 3}, itemStyle: {color: '#128a80'}, areaStyle: {color: {type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{offset: 0, color: 'rgba(18,138,128,.24)'}, {offset: 1, color: 'rgba(18,138,128,.01)'}]}}, data: rows.map(row => row.cumulativePrize)}]
  };
}
export function prizeOptions(counts, animate = true) {
  return {animation: animate, animationDuration: 500, aria: {enabled: true},
    grid: {left: 60, right: 55, top: 16, bottom: 28},
    tooltip: {trigger: 'axis', confine: true, renderMode: 'richText', axisPointer: {type: 'shadow'}, valueFormatter: value => `${Number(value).toLocaleString('zh-CN')}注`},
    xAxis: {type: 'value', minInterval: 1, axisLabel: {formatter: compact}, splitLine: {lineStyle: {color: '#eef3f5'}}},
    yAxis: {type: 'category', inverse: true, data: GRADES.slice(1), axisLine: {show: false}, axisTick: {show: false}},
    series: [{name: '中奖注数', type: 'bar', barMaxWidth: 16, data: counts.slice(1), itemStyle: {borderRadius: [0, 5, 5, 0], color: '#128a80'}, label: {show: true, position: 'right', formatter: params => Number(params.value).toLocaleString('zh-CN')}}]
  };
}
