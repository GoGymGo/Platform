import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle
} from 'react-native';

import { HUDBorderBox, TerminalText } from '@/components/cyber';
import type { SponsorPlacementKey } from '@/config/sponsorCampaigns';
import { colors, cyberGlow, fontFamilies, radii, spacing } from '@/constants/theme';
import { useSponsorCampaign } from '@/state/sponsorCampaign';

type SponsorTone = 'cyan' | 'pink' | 'amber';

type SponsorRailProps = {
  compact?: boolean;
  mark?: string;
  sponsorName?: string;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
};

type BrandVideoAdPlaceholderProps = {
  compact?: boolean;
  ctaLabel?: string;
  eventLabel?: string;
  onPress?: (event: GestureResponderEvent) => void;
  placement: SponsorPlacementKey;
  placementLabel?: string;
  sponsorName?: string;
  style?: StyleProp<ViewStyle>;
  tone?: SponsorTone;
};

export function SponsorRail({
  compact = false,
  mark,
  sponsorName,
  style,
  subtitle
}: SponsorRailProps) {
  const { campaign } = useSponsorCampaign();
  const resolvedMark = mark ?? campaign.sponsor.mark;
  const resolvedSponsorName = sponsorName ?? campaign.sponsor.railName;
  const resolvedSubtitle = subtitle ?? campaign.sponsor.subtitle;
  const sponsorTone: SponsorTone = campaign.status === 'approved' ? 'pink' : 'cyan';

  return (
    <HUDBorderBox
      style={[styles.sponsorRail, compact ? styles.sponsorRailCompact : null, style]}
      tone="muted"
    >
      <View
        style={[
          styles.sponsorMark,
          campaign.status === 'approved' ? null : styles.sponsorMarkPending,
          compact ? styles.sponsorMarkCompact : null
        ]}
      >
        <TerminalText accessibilityRole="text" glow tone={sponsorTone} variant={compact ? 'label' : 'title'}>
          {resolvedMark}
        </TerminalText>
      </View>
      <View style={styles.sponsorCopy}>
        {!compact ? (
          <TerminalText tone="dim" variant="micro">
            SPONSOR SIGNAL
          </TerminalText>
        ) : null}
        <TerminalText style={styles.sponsorTitle} tone="text" variant="body">
          {resolvedSponsorName}
        </TerminalText>
        {!compact ? (
          <TerminalText tone="muted" variant="body">
            {resolvedSubtitle}
          </TerminalText>
        ) : null}
      </View>
    </HUDBorderBox>
  );
}

export function BrandVideoAdPlaceholder({
  compact = false,
  ctaLabel,
  eventLabel,
  onPress,
  placement,
  placementLabel,
  sponsorName,
  style,
  tone = 'pink'
}: BrandVideoAdPlaceholderProps) {
  const { campaign, getPlacement } = useSponsorCampaign();
  const creative = getPlacement(placement);
  const sponsorConfirmed = campaign.status === 'approved';
  const resolvedTone: SponsorTone = sponsorConfirmed ? tone : 'cyan';
  const resolvedCtaLabel = sponsorConfirmed
    ? ctaLabel ?? creative.ctaLabel
    : 'ANNOUNCEMENT SOON';
  const resolvedEventLabel = sponsorConfirmed
    ? eventLabel ?? creative.eventLabel
    : 'REGIONAL SPONSOR ANNOUNCEMENT';
  const resolvedPlacementLabel = placementLabel ?? creative.placementLabel;
  const resolvedSponsorName = sponsorName ?? campaign.sponsor.displayName;

  if (!sponsorConfirmed) {
    return (
      <HUDBorderBox style={[styles.pendingCard, style]} tone="muted">
        <View style={[styles.brandMark, styles.brandMarkCyan, styles.pendingMark]}>
          <TerminalText glow tone="cyan" variant="label">
            {campaign.sponsor.mark}
          </TerminalText>
        </View>
        <View style={styles.pendingCopy}>
          <TerminalText glow tone="cyan" variant="micro">
            {`GOGYMGO CAMPAIGN // ${resolvedPlacementLabel}`}
          </TerminalText>
          <TerminalText style={styles.pendingTitle} tone="text" variant="body">
            SPONSOR-FUNDED PLACEMENT
          </TerminalText>
          <TerminalText tone="muted" variant="caption">
            CAMPAIGN PARTNER APPEARS HERE WHEN CONFIRMED.
          </TerminalText>
        </View>
      </HUDBorderBox>
    );
  }

  const card = (
    <HUDBorderBox style={[styles.card, compact ? styles.compactCard : null, style]} tone="muted">
      <View style={styles.headerRow}>
        <View
          style={[
            styles.brandMark,
            resolvedTone === 'cyan'
              ? styles.brandMarkCyan
              : resolvedTone === 'amber'
                ? styles.brandMarkAmber
                : styles.brandMarkPink
          ]}
        >
          <TerminalText glow tone={resolvedTone} variant="label">
            {campaign.sponsor.mark}
          </TerminalText>
        </View>
        <View style={styles.headerCopy}>
          <TerminalText glow tone={resolvedTone} variant="micro">
            {`${sponsorConfirmed ? 'BRAND VIDEO AD' : 'SPONSOR PLACEMENT'} // ${resolvedPlacementLabel}`}
          </TerminalText>
          <TerminalText style={styles.sponsorName} tone="text" variant="body">
            {resolvedSponsorName}
          </TerminalText>
        </View>
        <TerminalText glow tone={resolvedTone} variant="micro">
          {sponsorConfirmed ? '15S' : 'OPEN'}
        </TerminalText>
      </View>

      <View style={[styles.videoFrame, compact ? styles.compactVideoFrame : null]}>
        <View style={styles.videoTopBar}>
          <TerminalText tone="dim" variant="micro">
            {sponsorConfirmed ? 'SPONSORED VIDEO' : 'SPONSOR SLOT'}
          </TerminalText>
          <TerminalText glow tone={resolvedTone} variant="micro">
            {sponsorConfirmed ? 'READY' : 'RESERVED'}
          </TerminalText>
        </View>
        <View style={styles.playRow}>
          <View
            style={[
              styles.playButton,
              resolvedTone === 'cyan'
                ? styles.playButtonCyan
                : resolvedTone === 'amber'
                  ? styles.playButtonAmber
                  : styles.playButtonPink
            ]}
          >
            <TerminalText glow tone={resolvedTone} variant="micro">
              {sponsorConfirmed ? 'PLAY' : 'SOON'}
            </TerminalText>
          </View>
          <View style={styles.slotCopy}>
            <TerminalText style={styles.eventLabel} tone="text" variant="body">
              {resolvedEventLabel}
            </TerminalText>
            <TerminalText tone="muted" variant="micro">
              {sponsorConfirmed
                ? 'VIDEO CREATIVE PLACEHOLDER'
                : 'CREATIVE ARRIVES WHEN CAMPAIGN IS CONFIRMED'}
            </TerminalText>
          </View>
        </View>
      </View>

      <View style={styles.footerRow}>
        <TerminalText style={styles.footerText} tone="muted" variant="caption">
          {sponsorConfirmed
            ? 'SLOT RESERVED FOR BRAND CREATIVE AND IMPRESSION TRACKING.'
            : 'THIS SPACE IS RESERVED FOR THE MONTHLY REGIONAL SPONSOR.'}
        </TerminalText>
        <TerminalText glow tone={resolvedTone} variant="micro">
          {resolvedCtaLabel}
        </TerminalText>
      </View>
    </HUDBorderBox>
  );

  if (!onPress || !sponsorConfirmed) {
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
  sponsorRail: {
    width: 'auto',
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  sponsorMark: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.sponsorBorder,
    borderRadius: radii.sm,
    backgroundColor: colors.surfacePinkSoft
  },
  sponsorRailCompact: {
    minHeight: 44,
    gap: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md
  },
  sponsorMarkCompact: {
    width: 26,
    height: 26
  },
  sponsorCopy: {
    flex: 1
  },
  sponsorTitle: {
    marginTop: 1,
    fontFamily: fontFamilies.terminal
  },
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
  sponsorMarkPending: {
    borderColor: colors.borderCyanMedium,
    backgroundColor: colors.surfaceCyanSoft
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  pendingMark: {
    width: 30,
    height: 30
  },
  pendingCopy: {
    flex: 1,
    gap: 2
  },
  pendingTitle: {
    marginTop: 2,
    fontFamily: fontFamilies.display
  },
  brandMarkAmber: {
    borderColor: colors.borderWarning,
    backgroundColor: colors.surfaceWarning
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
  playButtonAmber: {
    borderColor: colors.borderWarning,
    backgroundColor: colors.surfaceWarning
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
    fontFamily: fontFamilies.body
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
