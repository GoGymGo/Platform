export type SessionTelemetryPreview = {
  elevatedMinutes: number;
  heartRate: number;
};

export function getSessionTelemetryPreview(
  elapsedSeconds: number
): SessionTelemetryPreview {
  return {
    elevatedMinutes: Math.min(20, Math.floor(elapsedSeconds / 60)),
    heartRate: 132 + Math.round(7 * Math.sin(elapsedSeconds / 4))
  };
}
