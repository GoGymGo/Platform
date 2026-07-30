import { verifiedPartnerGymCatalogAvailable } from '@/config/partnerGyms';

export function isGoGymGoPartnerCode(value: string, mode: 'entry' | 'exit') {
  if (!verifiedPartnerGymCatalogAvailable) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith(`gogymgo:gym:${mode}:`) || normalized.startsWith(`gogymgo://gym/${mode}/`)
  );
}
