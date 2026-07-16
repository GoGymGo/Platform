export function isGoGymGoPartnerCode(
  value: string,
  mode: 'entry' | 'exit'
) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith(`gogymgo:gym:${mode}:`) ||
    normalized.startsWith(`gogymgo://gym/${mode}/`)
  );
}
