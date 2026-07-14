import {
  defaultCompetitionRegion,
  type CompetitionRegion
} from '@/config/regions';

export type RegionCoordinates = {
  latitude: number;
  longitude: number;
};

export function resolveCompetitionRegionFromCoordinates(
  coordinates: RegionCoordinates
): CompetitionRegion | null {
  const insideBcDemoBounds =
    coordinates.latitude >= 48.2 &&
    coordinates.latitude <= 60.1 &&
    coordinates.longitude >= -139.1 &&
    coordinates.longitude <= -114.0;

  return insideBcDemoBounds ? defaultCompetitionRegion : null;
}

export function resolveCompetitionRegionFromPostalCode(
  value: string
): CompetitionRegion | null {
  const postalCode = normalizeCanadianPostalCode(value);
  const fsa = postalCode.replace(' ', '').slice(0, 3);
  return /^V\d[A-Z]$/.test(fsa) ? defaultCompetitionRegion : null;
}

export function normalizeCanadianPostalCode(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return compact.length > 3 ? `${compact.slice(0, 3)} ${compact.slice(3)}` : compact;
}

export function isCompleteCanadianPostalCode(value: string) {
  return /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i.test(
    value.trim()
  );
}
