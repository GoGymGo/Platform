import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

export function useMidSessionNotificationNavigation() {
  const router = useRouter();
  const workoutRoutePrefix = ['', 'workout', ''].join('/');
  const gymScannerRoute = ['', 'qr-scanner'].join('/');

  useEffect(() => {
    const openResponse = (response: Notifications.NotificationResponse | null) => {
      const route = response?.notification.request.content.data?.route;
      if (
        typeof route === 'string' &&
        (route.startsWith(workoutRoutePrefix) || route === gymScannerRoute)
      ) {
        router.push(route as Href);
      }
    };

    void Notifications.getLastNotificationResponseAsync().then(openResponse);
    const subscription = Notifications.addNotificationResponseReceivedListener(openResponse);
    return () => subscription.remove();
  }, [gymScannerRoute, router, workoutRoutePrefix]);
}
