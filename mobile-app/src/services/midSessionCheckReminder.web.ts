type MidSessionReminderInput = {
  checkAtSeconds: number;
  sessionId: string;
  startedAt: string;
  timeScale: number;
};

export async function scheduleMidSessionCheckReminder(
  _input: MidSessionReminderInput
) {
  return false;
}

export async function cancelMidSessionCheckReminder() {
  return Promise.resolve();
}

export async function signalMidSessionCheck() {
  return Promise.resolve();
}
