import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle
} from 'react-native';

import { HUDBorderBox, TerminalText } from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, radii, spacing } from '@/constants/theme';

type SponsorTone = 'cyan' | 'pink';

type BrandVideoAdPlaceholderProps = {
  compact?: boolean;
  ctaLabel?: string;
  eventLabel: string;
  onPress?: (event: GestureResponderEvent) => void;
  placementLabel: string;
  sponsorName?: string;
  style?: StyleProp<ViewStyle>;
  tone?: SponsorTone;
};

export function BrandVideoAdPlaceholder({
  compact = false,
  ctaLabel = 'VIEW OFFER ->',
  eventLabel,
  onPress,
  placementLabel,
  sponsorName = 'VOLT ENERGY',
  style,
  tone = 'pink'
}: BrandVideoAdPlaceholderProps) {
  const card = (
    <HUDBorderBox glow style={[styles.card, compact ? styles.compactCard : null, style]} tone={tone}>
      <View style={styles.headerRow}>
        <View style={[styles.brandMark, tone === 'cyan' ? styles.brandMarkCyan : styles.brandMarkPink]}>
          <TerminalText glow tone={tone} variant="label">
            V
          </TerminalText>
        </View>
        <View style={styles.headerCopy}>
          <TerminalText glow tone={tone} variant="micro">
            BRAND VIDEO AD // {placementLabel}
          </TerminalText>
          <TerminalText style={styles.sponsorName} tone="text" variant="body">
            {sponsorName}
          </TerminalText>
        </View>
        <TerminalText glow tone={tone} variant="micro">
          15S
        </TerminalText>
      </View>

      <View style={[styles.videoFrame, compact ? styles.compactVideoFrame : null]}>
        <View style={styles.videoTopBar}>
          <TerminalText tone="dim" variant="micro">
            SPONSORED VIDEO
          </TerminalText>
          <TerminalText glow tone={tone} variant="micro">
            READY
          </TerminalText>
        </View>
        <View style={styles.playRow}>
          <View style={[styles.playButton, tone === 'cyan' ? styles.playButtonCyan : styles.playButtonPink]}>
            <TerminalText glow tone={tone} variant="micro">
              PLAY
            </TerminalText>
          </View>
          <View style={styles.slotCopy}>
            <TerminalText style={styles.eventLabel} tone="text" variant="body">
              {eventLabel}
            </TerminalText>
            <TerminalText tone="muted" variant="micro">
              VIDEO CREATIVE PLACEHOLDER
            </TerminalText>
          </View>
        </View>
      </View>

      <View style={styles.footerRow}>
        <TerminalText style={styles.footerText} tone="muted" variant="micro">
          SLOT RESERVED FOR BRAND CREATIVE AND IMPRESSION TRACKING.
        </TerminalText>
        <TerminalText glow tone={tone} variant="micro">
          {ctaLabel}
        </TerminalText>
      </View>
    </HUDBorderBox>
  );

  if (!onPress) {
    return card;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed ? styles.pressed : null]}
    >
      {card}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%'
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg
  },
  compactCard: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  brandMark: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 9
  },
  brandMarkPink: {
    borderColor: colors.sponsorBorder,
    backgroundColor: colors.surfacePinkSoft
  },
  brandMarkCyan: {
    borderColor: colors.borderCyanMedium,
    backgroundColor: colors.surfaceCyanSoft
  },
  headerCopy: {
    flex: 1
  },
  sponsorName: {
    marginTop: 1,
    fontFamily: fontFamilies.display
  },
  videoFrame: {
    width: '100%',
    minHeight: 116,
    justifyContent: 'space-between',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.whiteAlpha10,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceVideoDark
  },
  compactVideoFrame: {
    minHeight: 86,
    padding: spacing.sm
  },
  videoTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  playRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md
  },
  playButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 24
  },
  playButtonPink: {
    borderColor: colors.borderPinkHeavy,
    backgroundColor: colors.surfacePinkStrong,
    ...cyberGlow.pink
  },
  playButtonCyan: {
    borderColor: colors.borderCyanHeavy,
    backgroundColor: colors.surfaceCyanStrong,
    ...cyberGlow.cyan
  },
  slotCopy: {
    flex: 1
  },
  eventLabel: {
    marginBottom: 2,
    fontFamily: fontFamilies.terminal
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  footerText: {
    flex: 1,
    fontFamily: fontFamilies.terminal
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
