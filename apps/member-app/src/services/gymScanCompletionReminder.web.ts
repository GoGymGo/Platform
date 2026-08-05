import type { GymScanCompletionReminderInput } from './gymScanCompletionReminder';

let reminderTimeout: ReturnType<typeof setTimeout> | null = null;

export async function scheduleGymScanCompletionReminder({
  gymName,
  minimumCompleteAt
}: GymScanCompletionReminderInput) {
  await cancelGymScanCompletionReminder();
  const triggerTime = Date.parse(minimumCompleteAt);
  const delay = triggerTime - Date.now();
  if (!Number.isFinite(triggerTime) || delay <= 0 || typeof window === 'undefined') {
    return false;
  }

  reminderTimeout = setTimeout(() => {
    reminderTimeout = null;
    if ('Notification' in window && window.Notification.permission === 'granted') {
      new window.Notification('Time to finish your workout', {
        body: `Your 30-minute minimum${gymName ? ` at ${gymName}` : ''} is complete. Return to the poster and scan again.`
      });
    }
  }, delay);
  return true;
}

export async function cancelGymScanCompletionReminder() {
  if (reminderTimeout !== null) {
    clearTimeout(reminderTimeout);
    reminderTimeout = null;
  }
}
