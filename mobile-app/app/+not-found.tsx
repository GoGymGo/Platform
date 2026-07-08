import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, fontFamilies, spacing, fontSizes } from '@/constants/theme';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <HUDBorderBox glow style={styles.card} tone="pink">
        <TerminalText glow tone="pink" variant="label">
          ROUTE OFFLINE
        </TerminalText>
        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          SCREEN NOT READY
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" variant="body">
          GOGYMGO IS MOVING PAGE BY PAGE INTO THE NATIVE HUD. RETURN TO THE
          OPENING FLOW.
        </TerminalText>
        <View style={styles.action}>
          <CyberButtonPrimary
            label="BACK TO START ->"
            onPress={() => router.replace('/welcome')}
            tone="pink"
          />
        </View>
      </HUDBorderBox>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.screenX,
    backgroundColor: colors.background
  },
  card: {
    maxWidth: 430,
    padding: spacing.xxl
  },
  title: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    lineHeight: 34
  },
  body: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.terminal
  },
  action: {
    marginTop: spacing.xl
  }
});
