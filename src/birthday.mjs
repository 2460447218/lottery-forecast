import {predict} from './engine.mjs';

function parseBirthday(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('请为每位亲人填写完整的公历生日。');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (year < 1900 || year > new Date().getFullYear() || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || value > new Date().toLocaleDateString('sv-SE')) throw new Error('请填写有效的公历生日，不能晚于今天。');
  return {year, month, day};
}

export function birthdayPick(dates, config) {
  if (!Array.isArray(dates) || !dates.length) throw new Error('请至少添加一位亲人的生日。');
  if (dates.length > 30) throw new Error('最多支持30位亲人的生日。');
  const unique = [...new Set(dates)].sort();
  const values = unique.map(parseBirthday);
  // Interleave each person's month, day and derived values so every birthday contributes.
  const groups = values.map(({year, month, day}) => [month, day, year % 100, month + day, month * day, year + month + day]);
  const candidates = groups[0].flatMap((_, index) => groups.map(group => group[index]));
  let seed = 2166136261;
  for (const char of unique.join('|')) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  function ranked(max) {
    const ranked = [...new Set(candidates.filter(n => n > 0).map(n => (n - 1) % max + 1))];
    const rest = Array.from({length: max}, (_, i) => i + 1).filter(n => !ranked.includes(n));
    let state = seed;
    for (let i = rest.length - 1; i > 0; i--) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const j = state % (i + 1);
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return [...ranked, ...rest];
  }
  const red = ranked(33), blue = ranked(16), sort = numbers => numbers.sort((a, b) => a - b);
  return {
    red: config.type === 'pool' ? sort(red.slice(0, config.redCount)) : [],
    dan: config.type === 'dan' ? sort(red.slice(0, config.danCount)) : [],
    tuo: config.type === 'dan' ? sort(red.slice(config.danCount, config.danCount + config.tuoCount)) : [],
    blue: sort(blue.slice(0, config.blueCount))
  };
}

export function predictBirthdays(draws, config, dates) {
  const pick = birthdayPick(dates, config);
  const result = predict(draws, {...config, strategy: 'manual', manual: pick});
  return {...result, birthday: true, label: '亲人生日组合', birthdayCount: dates.length};
}
