export function normalizeDateKey(value: Date | string): string {
  const normalized =
    value instanceof Date ? value.toISOString().slice(0, 10) : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error('Unexpected database date key.');
  }
  return normalized;
}
