/**
 * Send one request with the current Firebase token. A 401 is the only response
 * that triggers one forced token refresh and one retry.
 *
 * @template T
 * @param {{ getIdToken(forceRefresh?: boolean): Promise<string> }} activeUser
 * @param {(token: string) => Promise<T & { status: number }>} send
 * @returns {Promise<T & { status: number }>}
 */
export class FirebaseTokenUnavailableError extends Error {
  constructor() {
    super("The Firebase session token is unavailable.");
    this.name = "FirebaseTokenUnavailableError";
  }
}

export async function sendWithFirebaseTokenRecovery(activeUser, send) {
  const response = await send(await getToken(activeUser, false));
  if (response.status !== 401) return response;

  return send(await getToken(activeUser, true));
}

async function getToken(activeUser, forceRefresh) {
  try {
    return await activeUser.getIdToken(forceRefresh);
  } catch {
    throw new FirebaseTokenUnavailableError();
  }
}
