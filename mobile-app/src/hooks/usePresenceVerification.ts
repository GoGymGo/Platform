import { useCallback, useState } from 'react';

import { verifyLocalPresence } from '@/services/presenceVerification';
import { useAppTour } from '@/state/appTour';
import { appTourPresenceConfirmationMessage } from '@/testing/appTourData';

export function usePresenceVerification() {
  const { active: appTourActive } = useAppTour();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const verify = useCallback(async () => {
    setBusy(true);
    setMessage(null);

    try {
      if (appTourActive) {
        setMessage(appTourPresenceConfirmationMessage);
        return true;
      }

      const result = await verifyLocalPresence();
      if (!('message' in result)) {
        setMessage('Presence confirmed on this device.');
        return true;
      }

      setMessage(result.message);
      return false;
    } catch {
      setMessage('The device presence check could not start. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [appTourActive]);

  return {
    busy,
    message,
    verify
  };
}
