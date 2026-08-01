import { Redirect } from 'expo-router';

import DevelopmentAppTourScreen from '@/testing/AppTourScreen';

export default function AppTourRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <DevelopmentAppTourScreen />;
}
