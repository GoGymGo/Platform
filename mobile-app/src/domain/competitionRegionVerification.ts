import {
  competitionRegions,
  type CompetitionRegion
} from '@/config/regions';

export type RegionCoordinates = {
  latitude: number;
  longitude: number;
};

type RegionServiceArea = {
  center: RegionCoordinates;
  radiusKilometers: number;
  regionId: CompetitionRegion['id'];
};

const regionServiceAreas: readonly RegionServiceArea[] = [
  {
    regionId: 'toronto',
    center: { latitude: 43.6532, longitude: -79.3832 },
    radiusKilometers: 80
  },
  {
    regionId: 'vancouver',
    center: { latitude: 49.2827, longitude: -123.1207 },
    radiusKilometers: 75
  },
  {
    regionId: 'calgary',
    center: { latitude: 51.0447, longitude: -114.0719 },
    radiusKilometers: 80
  },
  {
    regionId: 'montreal',
    center: { latitude: 45.5017, longitude: -73.5673 },
    radiusKilometers: 80
  }
];

export function resolveCompetitionRegionFromCoordinates(
  coordinates: RegionCoordinates
): CompetitionRegion | null {
  const match = regionServiceAreas
    .map((area) => ({
      area,
      distance: getDistanceKilometers(coordinates, area.center)
    }))
    .filter(({ area, distance }) => distance <= area.radiusKilometers)
    .sort((first, second) => first.distance - second.distance)[0];

  return match
    ? competitionRegions.find((region) => region.id === match.area.regionId) ?? null
    : null;
}

function getDistanceKilometers(first: RegionCoordinates, second: RegionCoordinates) {
  const earthRadiusKilometers = 6371;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKilometers * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value: number) {
  return value * (Math.PI / 180);
}
