import { useEffect, useState } from 'react';

import {
  readPendingGymScan,
  subscribePendingGymScan,
  type PendingGymScan,
  type PendingGymScanSession
} from '@/services/pendingGymScan';

type PendingGymScanSessionState = {
  activeSession: PendingGymScanSession | null;
  ready: boolean;
};

const initialState: PendingGymScanSessionState = {
  activeSession: null,
  ready: false
};

export function usePendingGymScanSession() {
  const [state, setState] = useState<PendingGymScanSessionState>(initialState);

  useEffect(() => {
    let mounted = true;
    let subscriptionUpdated = false;
    const applyPending = (pending: PendingGymScan | null) => {
      if (!mounted) return;
      setState({
        activeSession: pending?.activeSession ?? null,
        ready: true
      });
    };
    const unsubscribe = subscribePendingGymScan((pending) => {
      subscriptionUpdated = true;
      applyPending(pending);
    });

    void readPendingGymScan()
      .then((pending) => {
        if (!subscriptionUpdated) applyPending(pending);
      })
      .catch(() => {
        if (!subscriptionUpdated) applyPending(null);
      });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return state;
}
