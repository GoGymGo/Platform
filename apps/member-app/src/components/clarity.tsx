import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native';

import { TerminalText } from '@/components/cyber';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import {
  dismissClarityTip,
  isClarityTipDismissed,
  type ClarityTipKey
} from '@/state/onboardingPreferences';
import { useAppTour } from '@/state/appTour';
import { useAuth } from '@/state/auth';

type FirstVisitTipProps = {
  body: string;
  guideLabel?: string;
  onOpenGuide?: () => void;
  style?: StyleProp<ViewStyle>;
  tip: ClarityTipKey;
  title?: string;
};

export function InlineHelpButton({
  label,
  onPress
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityHint="Opens a short guide"
      onPress={onPress}
      style={({ pressed }) => [
        styles.helpButton,
        pressed ? styles.pressed : null
      ]}
    >
      <TerminalText glow tone="cyan" variant="button">
        GUIDE
      </TerminalText>
    </Pressable>
  );
}

export function FirstVisitTip({
  body,
  guideLabel = 'Learn more',
  onOpenGuide,
  style,
  tip,
  title
}: FirstVisitTipProps) {
  const { active: appTourActive } = useAppTour();
  const { user } = useAuth();
  const [persistedVisible, setPersistedVisible] = useState(false);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const visible =
    !dismissedThisSession && (appTourActive || persistedVisible);

  useEffect(() => {
    let mounted = true;

    if (appTourActive) {
      return () => {
        mounted = false;
      };
    }

    if (!user) {
      void Promise.resolve().then(() => {
        if (mounted) {
          setPersistedVisible(false);
        }
      });
      return () => {
        mounted = false;
      };
    }

    void isClarityTipDismissed(user.uid, tip).then((dismissed) => {
      if (mounted) {
        setPersistedVisible(!dismissed);
      }
    });

    return () => {
      mounted = false;
    };
  }, [appTourActive, tip, user]);

  const dismiss = useCallback(() => {
    setDismissedThisSession(true);
    setPersistedVisible(false);

    if (!appTourActive && user) {
      void dismissClarityTip(user.uid, tip);
    }
  }, [appTourActive, tip, user]);

  if (!visible) {
    return null;
  }

  return (
    <View style={[styles.card, style]}>
      <View style={styles.copy}>
        {title ? (
          <TerminalText tone="cyan" uppercase={false} variant="caption">
            {title}
          </TerminalText>
        ) : null}
        <TerminalText style={styles.body} tone="muted" uppercase={false} variant="caption">
          {body}
        </TerminalText>
        {onOpenGuide ? (
          <TipAction label={guideLabel} onPress={onOpenGuide} tone="cyan" />
        ) : null}
      </View>
      <Pressable
        accessibilityLabel="Dismiss tip"
        accessibilityRole="button"
        onPress={dismiss}
        style={({ pressed }) => [
          styles.dismissButton,
          pressed ? styles.pressed : null
        ]}
      >
        <TerminalText tone="dim" uppercase={false} variant="button">
          ×
        </TerminalText>
      </Pressable>
    </View>
  );
}

function TipAction({
  label,
  onPress,
  tone
}: {
  label: string;
  onPress: () => void;
  tone: 'cyan' | 'muted';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        pressed ? styles.pressed : null
      ]}
    >
      <TerminalText
        style={styles.actionLabel}
        tone={tone}
        uppercase={false}
        variant="caption"
      >
        {label}
      </TerminalText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingRight: spacing.xs,
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.cyan,
    borderRadius: 4,
    backgroundColor: colors.surfaceCyanFaint
  },
  copy: {
    minWidth: 0,
    flex: 1,
    gap: 2
  },
  body: {
    fontFamily: fontFamilies.body
  },
  action: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingVertical: spacing.xs
  },
  actionLabel: {
    fontFamily: fontFamilies.bodyStrong
  },
  helpButton: {
    minWidth: 72,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderCyanButton,
    borderRadius: 22,
    backgroundColor: colors.surfaceCyanFaint
  },
  dismissButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22
  },
  pressed: {
    opacity: 0.7,
    backgroundColor: colors.whiteAlpha05
  }
});
