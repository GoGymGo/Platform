import { Redirect, useLocalSearchParams } from 'expo-router';

export default function StaticQrDeepLinkRoute() {
  const { credential } = useLocalSearchParams<{ credential?: string }>();
  return (
    <Redirect
      href={{
        pathname: '/qr-scanner',
        params: credential ? { credential } : {}
      }}
    />
  );
}
