export const fmt = n => Number(n).toLocaleString('zh-CN');
export const money = n => `${n < 0 ? '−' : ''}¥${fmt(Math.abs(n))}`;
export const pad = n => String(n).padStart(2, '0');
export const freshSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] || 1;
export function downloadCsv(name, rows) {
  const csv = '\ufeff' + rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
