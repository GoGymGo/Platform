export async function readEnrollmentGymPresence<TLocation, TPending>({
  readLocation,
  readPendingScan
}: {
  readLocation: () => Promise<TLocation>;
  readPendingScan: () => Promise<TPending>;
}) {
  // Start the browser location request synchronously from the member's tap.
  // iOS can otherwise lose the user-activation context while storage hydrates
  // and defer the permission prompt until a later attempt.
  const locationPromise = readLocation();
  const pendingScanPromise = readPendingScan();
  const [location, pendingScan] = await Promise.all([
    locationPromise,
    pendingScanPromise
  ]);

  return { location, pendingScan };
}
