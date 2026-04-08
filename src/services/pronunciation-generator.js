const enToRuMap = {
  a: 'а', b: 'б', c: 'к', d: 'д', e: 'е', f: 'ф',
  g: 'г', h: 'х', i: 'и', j: 'дж', k: 'к', l: 'л',
  m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р',
  s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'кс',
  y: 'й', z: 'з',
};

const comboMap = {
  sh: 'ш', ch: 'ч', th: 'т', ph: 'ф', gh: 'г',
  ck: 'к', ng: 'нг', qu: 'ку', ea: 'и', oo: 'у',
  ee: 'и', ai: 'эй', ay: 'эй', oy: 'ой', oi: 'ой',
  au: 'о', aw: 'о', ou: 'оу', ow: 'оу',
  ing: 'инг', tion: 'шн', sion: 'жн', ture: 'чер', sure: 'жер',
};

const specialRules = {
  steam: ['стим', 'тим', 'с тим', 'стеам', 'стима'],
  discord: ['дискорд', 'дискорт', 'дизкорд', 'дис корд', 'дизкорт'],
  minecraft: ['майнкрафт', 'майн крафт', 'майнкрафта'],
  spotify: ['спотифай', 'спотифей', 'спо ти фай'],
  telegram: ['телеграм', 'телиграм'],
  whatsapp: ['ватсап', 'воцап', 'вотсап'],
  chrome: ['хром', 'кроум', 'хроум'],
  firefox: ['фаерфокс', 'файерфокс'],
  photoshop: ['фотошоп'],
  excel: ['эксель', 'ексель', 'ексел'],
  word: ['ворд', 'вот'],
  powerpoint: ['пауэрпоинт', 'поверпоинт', 'паверпоинт'],
  notepad: ['блокнот', 'нотпад', 'ноутпад'],
  calculator: ['калькулятор', 'калкулятор'],
  explorer: ['проводник', 'эксплорер', 'експлорер'],
};

function generatePronunciations(name) {
  const lowerName = String(name || '').toLowerCase().trim();
  if (!lowerName) return [];
  if (specialRules[lowerName]) return Array.from(new Set([lowerName, ...specialRules[lowerName]]));

  const variations = new Set([lowerName]);

  let simple = '';
  for (const ch of lowerName) simple += enToRuMap[ch] || ch;
  variations.add(simple);

  let complex = lowerName;
  for (const [eng, ru] of Object.entries(comboMap)) {
    complex = complex.replace(new RegExp(eng, 'g'), ru);
  }
  complex = complex
    .split('')
    .map((ch) => enToRuMap[ch] || ch)
    .join('');
  variations.add(complex);

  if (lowerName.endsWith('er')) {
    variations.add(`${lowerName.slice(0, -2)}ер`);
    variations.add(`${lowerName.slice(0, -2)}а`);
  }
  if (lowerName.endsWith('le')) variations.add(`${lowerName.slice(0, -2)}л`);
  if (lowerName.length > 6) {
    const mid = Math.floor(lowerName.length / 2);
    variations.add(`${lowerName.slice(0, mid)} ${lowerName.slice(mid)}`);
  }

  return Array.from(variations);
}

module.exports = { generatePronunciations, specialRules };
