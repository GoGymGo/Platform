import * as AppleAuthentication from 'expo-apple-authentication';
import {
  GOOGLE_SIGN_IN_BUTTON_HEIGHT,
  GoogleSignInButton
} from 'react-native-nitro-google-signin';
import { Platform, StyleSheet, View } from 'react-native';

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
        <GoogleSignInButton
          accessibilityLabel="Continue with Google"
          colorScheme="dark"
          contentAlignment="center"
          disabled={disabled}
          loading={busyProvider === 'google'}
          onPress={onGooglePress}
          signInBehavior="none"
          size="wide"
          style={styles.googleButton}
        />
      ) : null}
      {Platform.OS === 'ios' && appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          cornerRadius={8}
          onPress={disabled ? () => undefined : onApplePress}
          style={[styles.appleButton, disabled ? styles.disabled : null]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md
  },
  googleButton: {
    width: '100%',
    height: GOOGLE_SIGN_IN_BUTTON_HEIGHT
  },
  appleButton: {
    width: '100%',
    height: 48
  },
  disabled: {
    opacity: 0.45
  }
});
