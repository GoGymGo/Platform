import { StyleSheet, View } from 'react-native';

import { CyberButtonOutline } from '@/components/cyber';
import { spacing } from '@/constants/theme';

type SocialAuthButtonsProps = {
  appleAvailable: boolean;
  busyProvider: 'apple' | 'google' | null;
  disabled: boolean;
  googleAvailable: boolean;
  onApplePress: () => void;
  onGooglePress: () => void;
};

export function SocialAuthButtons({
  appleAvailable,
  busyProvider,
  disabled,
  googleAvailable,
  onApplePress,
  onGooglePress
}: SocialAuthButtonsProps) {
  return (
    <View style={styles.stack}>
      {googleAvailable ? (
        <CyberButtonOutline
          disabled={disabled}
          label={
            busyProvider === 'google'
              ? 'CONNECTING TO GOOGLE...'
              : 'CONTINUE WITH GOOGLE'
          }
          onPress={onGooglePress}
        />
      ) : null}
      {appleAvailable ? (
        <CyberButtonOutline
          disabled={disabled}
          label={
            busyProvider === 'apple'
              ? 'CONNECTING TO APPLE...'
              : 'CONTINUE WITH APPLE'
          }
          onPress={onApplePress}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md
  }
});
