export function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}
