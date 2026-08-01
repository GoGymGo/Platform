import type { StyleProp, ViewStyle } from 'react-native';

import {
  CyberButtonPrimary,
  HUDBorderBox,
  TerminalText
} from '@/components/cyber';
import {
  createAppTourGymQrPayload,
  type AppTourQrMode
} from '@/testing/appTourData';

export function AppTourQrSimulator({
  onConfirm,
  scanLocked,
  scanMode,
  style
}: {
  onConfirm: (payload: string) => void;
  scanLocked: boolean;
  scanMode: AppTourQrMode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <HUDBorderBox style={style} tone="cyan">
      <TerminalText glow tone="cyan" variant="label">
        BROWSER PREVIEW QR
      </TerminalText>
      <TerminalText tone="muted" uppercase={false} variant="body">
        Use a sample partner-gym code without opening the camera.
      </TerminalText>
      <CyberButtonPrimary
        disabled={scanLocked}
        label={scanLocked ? 'Sample QR complete' : 'Confirm sample QR'}
        onPress={() => onConfirm(createAppTourGymQrPayload(scanMode))}
      />
    </HUDBorderBox>
  );
}
