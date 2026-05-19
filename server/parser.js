const KEYS = {
  'тип': 'type',
  'заголовок': 'title',
  'цена': 'price',
  'статус': 'status',
  'площадь': 'area',
  'комнаты': 'rooms',
  'описание': 'description',
};

const TYPE_NORM = { 'квартира': 'квартира', 'вилла': 'вилла', 'участок': 'участок' };
const STATUS_NORM = { 'продажа': 'продажа', 'аренда': 'аренда' };

export function parseCaption(text) {
  if (!text || typeof text !== 'string') return {};
  const out = {};
  const descLines = [];
  let descMode = false;
  const lines = text.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (descMode) { descLines.push(rawLine); continue; }
    if (line.trim() === '') { descMode = true; continue; }
    const m = /^([A-Za-zА-Яа-яЁё]+)\s*:\s*(.+)$/.exec(line);
    if (!m) { descMode = true; descLines.push(rawLine); continue; }
    const key = KEYS[m[1].toLowerCase()];
    const value = m[2].trim();
    if (!key) { descMode = true; descLines.push(rawLine); continue; }
    if (key === 'description') { descMode = true; descLines.push(value); continue; }
    if (key === 'type') out.type = TYPE_NORM[value.toLowerCase()] || value;
    else if (key === 'status') out.status = STATUS_NORM[value.toLowerCase()] || value;
    else out[key] = value;
  }
  const desc = descLines.join('\n').trim();
  if (desc) out.description = desc;
  return out;
}

export const REQUIRED_FIELDS = ['type', 'title', 'price', 'status'];

export function missingFields(draft) {
  return REQUIRED_FIELDS.filter((k) => !draft[k] || !String(draft[k]).trim());
}
