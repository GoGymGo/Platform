export type GymScanCompletionReminderInput = {
  gymName: string | null;
  minimumCompleteAt: string;
  sessionId: string;
};

export async function scheduleGymScanCompletionReminder(
  _input: GymScanCompletionReminderInput
): Promise<boolean> {
  return false;
}

export async function cancelGymScanCompletionReminder(): Promise<void> {
  return Promise.resolve();
}
