/**
 * Keep pilot capabilities in one place so version 2 verification methods can
 * be restored without rebuilding their screens or domain types. Disabled
 * capabilities must not appear in navigation, App Tour, permission prompts,
 * or player-facing method choices.
 */
export const workoutVerificationCapabilities = {
  devicePresence: false,
  heartRate: false,
  midSessionPresence: false,
  partnerGymQr: true
} as const;

export const heartRateTelemetryAvailable =
  workoutVerificationCapabilities.heartRate;
export const devicePresenceVerificationAvailable =
  workoutVerificationCapabilities.devicePresence;
export const midSessionPresenceVerificationAvailable =
  workoutVerificationCapabilities.midSessionPresence;
export const legacyTimedWorkoutFlowAvailable =
  heartRateTelemetryAvailable ||
  devicePresenceVerificationAvailable ||
  midSessionPresenceVerificationAvailable;
