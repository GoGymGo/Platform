import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityRole,
  type StyleProp,
  type TextStyle,
  type ViewStyle
} from 'react-native';

import { CyberButtonOutline, HUDBorderBox, TerminalText } from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, radii, spacing } from '@/constants/theme';
import { getVisibleStreakUnits, type StreakBadgeKey } from '@/domain/streakBadges';
import type { StreakCounts, StreakSummary } from '@/domain/streaks';

type StreakKey = StreakBadgeKey;
type StreakTone = 'amber' | 'cyan' | 'green' | 'pink';

type StreakRewardsProps = {
  isError?: boolean;
  isLoading?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
  style?: StyleProp<ViewStyle>;
  summary?: StreakSummary | null;
};

type BadgeDefinition = {
  backgroundColor: string;
  borderColor: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  key: StreakKey;
  label: string;
  rank: number;
  tone: StreakTone;
  unit: string;
};

const badges: readonly BadgeDefinition[] = [
  {
    backgroundColor: colors.surfaceCyanSoft,
    borderColor: colors.borderCyanGlow,
    icon: 'flash',
    key: 'daily',
    label: 'DAILY',
    rank: 1,
    tone: 'cyan',
    unit: 'day'
  },
  {
    backgroundColor: colors.surfaceSuccess,
    borderColor: colors.borderSuccessGlow,
    icon: 'flame',
    key: 'weekly',
    label: 'WEEKLY',
    rank: 2,
    tone: 'green',
    unit: 'week'
  },
  {
    backgroundColor: colors.surfacePink,
    borderColor: colors.borderPinkGlow,
    icon: 'trophy',
    key: 'monthly',
    label: 'MONTHLY',
    rank: 3,
    tone: 'pink',
    unit: 'month'
  },
  {
    backgroundColor: colors.surfaceWarning,
    borderColor: colors.borderWarningGlow,
    icon: 'star',
    key: 'yearly',
    label: 'YEARLY',
    rank: 4,
    tone: 'amber',
    unit: 'year'
  }
] as const;

function getVisibleStreakBadges(streaks: StreakCounts, maximum = 2) {
  return getVisibleStreakUnits(streaks, maximum).flatMap(({ count, key }) => {
    const badge = badges.find((candidate) => candidate.key === key);
    return badge ? [{ badge, count }] : [];
  });
}

function formatAsOfDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? dateKey
    : new Intl.DateTimeFormat('en-CA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(date);
}

function formatTimeZoneLabel(timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      timeZoneName: 'long'
    }).formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value ?? timeZone;
  } catch {
    return timeZone.replaceAll('_', ' ');
  }
}

export function StreakRewards({
  isError = false,
  isLoading = false,
  onRetry,
  retrying = false,
  style,
  summary
}: StreakRewardsProps) {
  const visibleBadges = summary ? getVisibleStreakBadges(summary.streaks) : [];
  const hasActiveStreak = visibleBadges.length > 0;

  return (
    <HUDBorderBox style={[styles.panel, style]} tone="muted">
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <TerminalText tone="cyan" variant="label">
            GYM STREAK REWARDS
          </TerminalText>
          <TerminalText style={styles.description} tone="muted" uppercase={false} variant="body">
            Your current verified gym streak.
          </TerminalText>
        </View>
        <View style={styles.statusPill}>
          <TerminalText glow={hasActiveStreak} tone={hasActiveStreak ? 'green' : 'dim'} variant="micro">
            {isLoading
              ? 'SYNCING'
              : isError || !summary
                ? 'UNAVAILABLE'
                : hasActiveStreak
                  ? 'ACTIVE'
                  : 'LOCKED'}
          </TerminalText>
        </View>
      </View>

      {isError ? (
        <View style={styles.syncState}>
          <TerminalText live="assertive" tone="red" uppercase={false} variant="body">
            Your verified streak could not be loaded. No saved or estimated streak is being shown.
          </TerminalText>
          {onRetry ? (
            <CyberButtonOutline
              disabled={retrying}
              label={retrying ? 'RETRYING...' : 'RETRY STREAK SYNC'}
              onPress={onRetry}
              tone="red"
            />
          ) : null}
        </View>
      ) : isLoading ? (
        <TerminalText live="polite" style={styles.syncState} tone="muted" uppercase={false} variant="body">
          Syncing authoritative verified workout dates...
        </TerminalText>
      ) : summary ? (
        <View style={styles.badgeGrid}>
          {(visibleBadges.length > 0
          ? visibleBadges
          : [{ badge: badges[0], count: 0 }]
        ).map(({ badge, count }) => (
          <StreakBadge badge={badge} count={count} key={badge.key} />
        ))}
        </View>
      ) : (
        <TerminalText style={styles.syncState} tone="muted" uppercase={false} variant="body">
          Streak status is unavailable until the server sync completes.
        </TerminalText>
      )}

      <TerminalText live={isLoading ? 'polite' : undefined} style={styles.asOf} tone="dim" uppercase={false} variant="caption">
        {isLoading
          ? 'Syncing your verified gym logs...'
          : summary
            ? `As of ${formatAsOfDate(summary.asOfDate)} · ${formatTimeZoneLabel(summary.timezone)}`
            : 'Only an authoritative server response can unlock streak badges.'}
      </TerminalText>
    </HUDBorderBox>
  );
}

export function StreakBadgeStrip({
  maximum = 2,
  streaks
}: {
  maximum?: number;
  streaks: StreakCounts;
}) {
  const earnedBadges = getVisibleStreakBadges(streaks, maximum);

  if (earnedBadges.length === 0) {
    return null;
  }

  return (
    <View
      accessibilityLabel={`${earnedBadges.length} earned streak ${earnedBadges.length === 1 ? 'badge' : 'badges'}`}
      style={styles.badgeStrip}
    >
      {earnedBadges.map(({ badge, count }) => (
        <View
          accessibilityLabel={`${badge.label} badge, ${count} ${count === 1 ? badge.unit : `${badge.unit}s`}`}
          accessibilityRole="image"
          key={badge.key}
          style={[
            styles.miniBadge,
            {
              backgroundColor: badge.backgroundColor,
              borderColor: badge.borderColor
            },
            cyberGlow[badge.tone]
          ]}
        >
          <Ionicons color={badge.borderColor} name={badge.icon} size={12} />
          <TerminalText style={styles.miniBadgeCount} tone={badge.tone} variant="micro">
            {count}
          </TerminalText>
        </View>
      ))}
    </View>
  );
}

export function UserAlias({
  accessibilityRole,
  alias,
  glow = false,
  maximum = 2,
  prefix = '',
  streaks,
  style,
  textStyle,
  tone = 'text',
  uppercase,
  variant = 'body'
}: {
  accessibilityRole?: AccessibilityRole;
  alias: string;
  glow?: boolean;
  maximum?: number;
  prefix?: string;
  streaks?: StreakCounts | null;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  tone?: ComponentProps<typeof TerminalText>['tone'];
  uppercase?: boolean;
  variant?: ComponentProps<typeof TerminalText>['variant'];
}) {
  return (
    <View style={[styles.userAlias, style]}>
      <TerminalText
        accessibilityRole={accessibilityRole}
        glow={glow}
        style={[styles.userAliasText, textStyle]}
        tone={tone}
        uppercase={uppercase}
        variant={variant}
      >
        {prefix}{alias}
      </TerminalText>
      {streaks ? <StreakBadgeStrip maximum={maximum} streaks={streaks} /> : null}
    </View>
  );
}

function StreakBadge({ badge, count }: { badge: BadgeDefinition; count: number }) {
  const active = count > 0;
  const unit = count === 1 ? badge.unit : `${badge.unit}s`;
  const activeStyle = {
    backgroundColor: badge.backgroundColor,
    borderColor: badge.borderColor
  };

  return (
    <View
      accessibilityLabel={`${badge.label} streak: ${count} ${unit}`}
      accessibilityRole="image"
      style={[styles.badgeCard, active ? activeStyle : styles.badgeCardLocked]}
    >
      <View style={styles.rankMarkers}>
        {Array.from({ length: badge.rank }, (_, index) => (
          <View
            key={index}
            style={[styles.rankMarker, active ? { backgroundColor: badge.borderColor } : styles.rankMarkerLocked]}
          />
        ))}
      </View>

      <View style={[styles.medallion, active ? [activeStyle, cyberGlow[badge.tone]] : styles.medallionLocked]}>
        <View
          style={[styles.medallionInner, active ? { borderColor: badge.borderColor } : styles.medallionInnerLocked]}
        >
          <Ionicons
            color={active ? badge.borderColor : colors.dim}
            name={badge.icon}
            size={30}
          />
          {active ? (
            <TerminalText style={styles.count} tone={badge.tone} variant="micro">
              X{count}
            </TerminalText>
          ) : null}
        </View>
      </View>

      <TerminalText glow={active} style={styles.badgeLabel} tone={active ? badge.tone : 'dim'} variant="label">
        {badge.label}
      </TerminalText>
      <TerminalText tone={active ? 'muted' : 'dim'} variant="micro">
        {active ? `${count} ${unit}` : 'LOCKED'}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.lg,
    padding: spacing.lg
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  headerCopy: {
    flex: 1
  },
  description: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.body
  },
  statusPill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelSoft
  },
  badgeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 3
  },
  userAlias: {
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs
  },
  userAliasText: {
    flexShrink: 1
  },
  miniBadge: {
    width: 24,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderWidth: 1,
    borderRadius: 12
  },
  miniBadgeCount: {
    fontFamily: fontFamilies.terminal,
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: 0
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md
  },
  syncState: {
    gap: spacing.sm
  },
  badgeCard: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 174,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radii.lg
  },
  badgeCardLocked: {
    opacity: 0.58,
    borderColor: colors.borderMutedDisabled,
    backgroundColor: colors.panelSoft
  },
  rankMarkers: {
    height: 4,
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  rankMarker: {
    width: 14,
    height: 2,
    borderRadius: 1
  },
  rankMarkerLocked: {
    backgroundColor: colors.dim
  },
  medallion: {
    width: 82,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 41
  },
  medallionLocked: {
    borderColor: colors.borderMuted,
    backgroundColor: colors.panel
  },
  medallionInner: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 32,
    backgroundColor: colors.backgroundAlpha72
  },
  medallionInnerLocked: {
    borderColor: colors.borderMutedDisabled
  },
  count: {
    fontFamily: fontFamilies.display,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0,
    textAlign: 'center'
  },
  badgeLabel: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  asOf: {
    textAlign: 'center'
  }
});
