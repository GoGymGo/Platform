import { isLocalPreviewEnabled } from '@/config/firebase';

export const sessionTimeScale = __DEV__ && isLocalPreviewEnabled ? 23 : 1;
