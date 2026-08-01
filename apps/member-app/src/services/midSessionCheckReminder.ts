export type MidSessionReminderInput = {
  checkAtSeconds: number;
  sessionId: string;
  startedAt: string;
  timeScale: number;
};

export async function scheduleMidSessionCheckReminder(
  _input: MidSessionReminderInput
): Promise<boolean> {
  return false;
}

export async function cancelMidSessionCheckReminder(): Promise<void> {
  return Promise.resolve();
}

export async function signalMidSessionCheck(): Promise<void> {
  return Promise.resolve();
}
