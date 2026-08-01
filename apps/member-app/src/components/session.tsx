import { StyleSheet } from 'react-native';

import {
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, fontFamilies, spacing } from '@/constants/theme';

type SessionUnavailableProps = {
  actionLabel?: string;
  body: string;
  onAction: () => void;
  title?: string;
};

export function SessionUnavailable({
  actionLabel = 'CHOOSE SESSION PATH ->',
  body,
  onAction,
  title = 'SESSION NOT ACTIVE'
}: SessionUnavailableProps) {
  return (
    <ScreenContainer contentStyle={styles.screen}>
      <HUDBorderBox glow style={styles.card} tone="red">
        <TerminalText glow tone="red" variant="label">
          SESSION CHECK
        </TerminalText>
        <TerminalText glow style={styles.title} tone="text" variant="title">
          {title}
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
          {body}
        </TerminalText>
        <CyberButtonPrimary
          label={actionLabel}
          onPress={onAction}
          style={styles.action}
        />
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
    maxWidth: 390,
    padding: spacing.xxl
  },
  title: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.display
  },
  body: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.body
  },
  action: {
    marginTop: spacing.xl
  }
});
