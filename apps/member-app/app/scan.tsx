import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { ScreenLoadingState } from '@/components/cyber';
import { extractGymScanRouteCredential } from '@/domain/gymScan';
import { gymScanAuthNext, gymScanWorkoutRoute } from '@/navigation/gymScanFlow';
import { rememberGymScanCredential } from '@/services/pendingGymScan';
import { useAuth } from '@/state/auth';

export default function StaticQrDeepLinkRoute() {
  const router = useRouter();
  const parameters = useLocalSearchParams<Record<string, string | string[]>>();
  const { loading, user } = useAuth();
  const routed = useRef(false);
  const [intentReady, setIntentReady] = useState(false);
  const credential = extractGymScanRouteCredential(parameters);

  useEffect(() => {
    let active = true;

    async function rememberPoster() {
      if (!credential) {
        if (active) {
          routed.current = true;
          router.replace('/join');
        }
        return;
      }

      try {
        await rememberGymScanCredential(credential);
        if (active) {
          setIntentReady(true);
        }
      } catch {
        if (active) {
          routed.current = true;
          router.replace('/join');
        }
      }
    }

    void rememberPoster();
    return () => {
      active = false;
    };
  }, [credential, router]);

  useEffect(() => {
    if (!intentReady || loading || routed.current) {
      return;
    }

    routed.current = true;
    if (!user) {
      router.replace({ pathname: '/sign-in', params: { next: gymScanAuthNext } });
      return;
    }
    if (!user.emailVerified) {
      router.replace({ pathname: '/verify-email', params: { next: gymScanAuthNext } });
      return;
    }
    router.replace(gymScanWorkoutRoute);
  }, [intentReady, loading, router, user]);

  return <ScreenLoadingState body="Preparing your gym workout." />;
}
