import {predict, validateConfig} from './engine.mjs';

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
  const groups = [...new Set(dates)].sort().map(date => {
    const {year, month, day} = parseBirthday(date);
    return [['月份', month], ['日期', day], ['年份后两位', year % 100], ['月＋日', month + day], ['月×日', month * day], ['年＋月＋日', year + month + day]].map(([label, value]) => ({label, value, date}));
  });
  const sources = {red: {}, blue: {}};
  for (const [color, max, numbers] of [['red', 33, [...pick.red, ...pick.dan, ...pick.tuo]], ['blue', 16, pick.blue]]) {
    for (let step = 0; step < 6; step++) for (const group of groups) {
      const {label, value, date} = group[step], number = (value - 1) % max + 1;
      if (value > 0 && numbers.includes(number) && !sources[color][number]) sources[color][number] = {kind: 'birthday', text: `${date}的${label}：${value}${value !== number ? ` → ${number}（映射到1—${max}）` : ''}`};
    }
    for (const number of numbers) sources[color][number] ??= {kind: 'fixed', text: '固定补号：生日候选不足，按全部生日确定的顺序补齐'};
  }
  return {...result, birthday: true, label: '亲人生日组合', birthdayCount: dates.length, sources};
}

// The mixed mode reserves birthday numbers first, then samples without replacement.
export function predictBirthdayMix(draws, input, people, options = {}) {
  const config = validateConfig({...input, strategy: 'hot100'}, draws.length, true);
  if (!Array.isArray(people) || !people.length || people.length > 30) throw new Error('请填写1—30位亲人的生日。');
  const capacity = config.type === 'dan' ? config.danCount + config.tuoCount : config.redCount;
  const quota = options.birthdayRedCount ?? Math.min(3, capacity);
  if (!Number.isInteger(quota) || quota < 1 || quota > capacity) throw new Error(`生日红球个数需要是1—${capacity}之间的整数。`);
  const round = options.round ?? 0, seed = options.seed ?? 1;
  if (!Number.isSafeInteger(round) || round < 0 || !Number.isInteger(seed) || seed < 1 || seed > 4294967295) throw new Error('组合编号无效，请重新生成。');
  const groups = new Map();
  people.forEach((person, index) => {
    const date = parseBirthday(person.date);
    const label = String(person.name || '').trim() || `亲人${index + 1}`;
    if (groups.has(person.date)) groups.get(person.date).labels.push(label);
    else groups.set(person.date, {date, key: person.date, labels: [label]});
  });
  const ordered = [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
  const offset = ordered.length > quota ? round % ordered.length : 0;
  const family = [...ordered.slice(offset), ...ordered.slice(0, offset)];
  function candidates(person, max) {
    const {year, month, day} = person.date;
    const raw = [['月份', month], ['日期', day], ['年份后两位', year % 100], ['月＋日', month + day], ['月×日', month * day], ['年＋月＋日', year + month + day]];
    const seen = new Set();
    return raw.filter(([, value]) => value > 0).map(([label, value]) => ({number: (value - 1) % max + 1, value, label})).filter(item => {
      if (seen.has(item.number)) return false;
      seen.add(item.number); return true;
    }).map(item => ({...item, source: {kind: 'birthday', person: person.key, text: `${person.labels.join(' / ')}的${item.label}：${item.value}${item.value !== item.number ? ` → ${item.number}（映射到1—${max}）` : ''}`}}));
  }
  const redCandidates = family.map(person => candidates(person, 33));
  // Matching lets a person use another birthday candidate when two people share a month.
  const owners = new Map(), assigned = new Map();
  function assign(index, seen) {
    for (const item of redCandidates[index]) {
      if (seen.has(item.number)) continue;
      seen.add(item.number);
      const owner = owners.get(item.number);
      if (owner === undefined || assign(owner, seen)) {
        owners.set(item.number, index); assigned.set(index, item); return true;
      }
    }
    return false;
  }
  for (let i = 0; i < family.length && assigned.size < quota; i++) assign(i, new Set());
  const red = [], sources = {red: {}, blue: {}};
  function add(color, item) {sources[color][item.number] = item.source; (color === 'red' ? red : blue).push(item.number);}
  for (let i = 0; i < family.length; i++) if (assigned.has(i)) add('red', assigned.get(i));
  for (let step = 0; step < 6 && red.length < quota; step++) {
    for (const list of redCandidates) {
      const item = list[step];
      if (red.length < quota && item && !red.includes(item.number)) add('red', item);
    }
  }
  const birthdayRedCount = red.length;
  const blue = [];
  // One blue birthday slot rotates independently; remaining blue slots are random.
  add('blue', candidates(ordered[round % ordered.length], 16)[0]);
  let state = seed >>> 0;
  function fill(color, numbers, max, count) {
    const rest = Array.from({length: max}, (_, i) => i + 1).filter(n => !numbers.includes(n));
    for (let i = rest.length - 1; i > 0; i--) {
      state += 0x6D2B79F5;
      let t = Math.imul(state ^ state >>> 15, state | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      const j = Math.floor(((t ^ t >>> 14) >>> 0) / 4294967296 * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    for (const number of rest.slice(0, count - numbers.length)) add(color, {number, source: {kind: 'random', text: '随机补号：从尚未入选的号码中随机抽取'}});
  }
  fill('red', red, 33, capacity); fill('blue', blue, 16, config.blueCount);
  const sort = values => [...values].sort((a, b) => a - b);
  const pick = {red: config.type === 'pool' ? sort(red) : [], dan: config.type === 'dan' ? sort(red.slice(0, config.danCount)) : [], tuo: config.type === 'dan' ? sort(red.slice(config.danCount)) : [], blue: sort(blue)};
  const selected = new Set(red.filter(n => sources.red[n].kind === 'birthday').map(n => sources.red[n].person));
  return {...predict(draws, {...config, strategy: 'manual', manual: pick}), birthday: true, mixed: true, label: '家庭生日＋随机组合', birthdayCount: people.length, sources, round, seed,
    birthdayRedCount, requestedBirthdayRedCount: quota, randomRedCount: capacity - birthdayRedCount,
    participating: ordered.filter(person => selected.has(person.key)).map(person => person.labels.join(' / ')),
    waiting: ordered.filter(person => !selected.has(person.key)).map(person => person.labels.join(' / '))};
}
