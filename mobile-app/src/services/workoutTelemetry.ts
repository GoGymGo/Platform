export type WorkoutTelemetry = {
  elevatedMinutes: number;
  heartRate: number;
};

/**
 * Native heart-rate providers will implement this boundary. Until then the
 * app reports telemetry as unavailable instead of manufacturing device data.
 */
export function readWorkoutTelemetry(): WorkoutTelemetry | null {
  return null;
}
