import { Redirect } from 'expo-router';

import { browserTestPreviewEnabled } from '@/config/browserTestPreview';
import BrowserTestPreviewScreen from '@/testing/AppTourScreen';

export default function TestPreviewRoute() {
  if (!browserTestPreviewEnabled) {
    return <Redirect href="/" />;
  }

  return <BrowserTestPreviewScreen />;
}
