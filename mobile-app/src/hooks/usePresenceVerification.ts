import { useCallback, useState } from 'react';

import { isLocalPreviewEnabled } from '@/config/firebase';
import { verifyLocalPresence } from '@/services/presenceVerification';

export function usePresenceVerification() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const verify = useCallback(async () => {
    setBusy(true);
    setMessage(null);

    try {
      const result = await verifyLocalPresence();
      if (!('message' in result)) {
        setMessage(
          result.status === 'simulated'
            ? 'Demo presence check simulated. The native app uses your device authentication prompt.'
            : 'Presence confirmed on this device.'
        );
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
  }, []);

  return {
    busy,
    buttonLabel: isLocalPreviewEnabled ? 'SIMULATE PRESENCE CHECK ->' : 'VERIFY PRESENCE ->',
    message,
    verify
  };
}
