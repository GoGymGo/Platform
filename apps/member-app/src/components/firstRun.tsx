import type { PropsWithChildren } from 'react';
import {
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle
} from 'react-native';

import { GoGymGoWordmark } from '@/components/brandWordmark';
import {
  CyberButtonOutline,
  CyberButtonPrimary,
  ScreenContainer
} from '@/components/cyber';
import { colors, spacing } from '@/constants/theme';

type FirstRunTone = 'cyan' | 'pink' | 'green' | 'amber' | 'red';

type FirstRunButtonProps = {
  accessibilityHint?: string;
  disabled?: boolean;
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  tone?: FirstRunTone;
};

export function FirstRunScreen({ children }: PropsWithChildren) {
  return (
    <ScreenContainer frameStyle={styles.screenFrame}>
      <FirstRunFrame>{children}</FirstRunFrame>
    </ScreenContainer>
  );
}

export function FirstRunFrame({ children }: PropsWithChildren) {
  return <View style={styles.frame}>{children}</View>;
}

export function FirstRunBrandRail() {
  return (
    <View style={styles.brandRail}>
      <GoGymGoWordmark compact style={styles.brandWordmark} />
      <View style={styles.brandRule} />
    </View>
  );
}

export function FirstRunPrimaryButton(props: FirstRunButtonProps) {
  return <CyberButtonPrimary {...props} />;
}

export function FirstRunSecondaryButton(props: FirstRunButtonProps) {
  return <CyberButtonOutline {...props} />;
}

const styles = StyleSheet.create({
  screenFrame: {
    maxWidth: 480
  },
  frame: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.background
  },
  brandRail: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md
  },
  brandWordmark: {
    fontSize: 21,
    lineHeight: 28,
    letterSpacing: 0.4
  },
  brandRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderCyanMedium
  }
});
