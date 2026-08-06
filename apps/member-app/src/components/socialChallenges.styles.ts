import { StyleSheet } from 'react-native';

import { colors, fontFamilies, fontSizes, radii, spacing } from '@/constants/theme';

export const styles = StyleSheet.create({
  hubTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg
  },
  hubTab: {
    minHeight: 48,
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha45
  },
  hubTabSelected: {
    borderColor: colors.borderCyanBright,
    backgroundColor: colors.surfaceCyanActive
  },
  tabCount: {
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: 11,
    backgroundColor: colors.whiteAlpha06
  },
  tabCountSelected: {
    backgroundColor: colors.surfaceSuccess
  },
  builder: {
    gap: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  builderTitle: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.title
  },
  builderProgress: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  builderProgressStep: {
    minWidth: 0,
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs
  },
  builderProgressMarker: {
    width: '100%',
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha45
  },
  builderProgressMarkerActive: {
    borderColor: colors.borderCyanBright,
    backgroundColor: colors.surfaceCyanActive
  },
  builderProgressMarkerComplete: {
    borderColor: colors.borderSuccess,
    backgroundColor: colors.surfaceSuccess
  },
  builderNavigation: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm
  },
  builderBackButton: {
    flex: 0.38
  },
  builderNextButton: {
    minWidth: 0,
    flex: 1
  },
  challengeSummary: {
    gap: spacing.xs,
    padding: spacing.md
  },
  fieldGroup: {
    gap: spacing.sm
  },
  twoColumnControls: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  choiceCard: {
    minHeight: 64,
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha45
  },
  choiceCardSelected: {
    borderColor: colors.borderPinkGlow,
    backgroundColor: colors.surfacePinkActive
  },
  choiceCopy: {
    minWidth: 0,
    flex: 1
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  activityChip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha45
  },
  activityChipSelected: {
    borderColor: colors.borderCyanBright,
    backgroundColor: colors.surfaceCyanActive
  },
  goalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: spacing.md
  },
  counterShell: {
    gap: spacing.xs
  },
  counterControl: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanStrong,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceCyanGhost,
    overflow: 'hidden'
  },
  iconButton: {
    width: 44,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center'
  },
  counterValue: {
    minWidth: 42,
    textAlign: 'center',
    fontSize: fontSizes.title
  },
  periodControl: {
    minWidth: 150,
    flex: 1,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    overflow: 'hidden'
  },
  segmentButton: {
    minHeight: 48,
    minWidth: 72,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.panelAlpha45
  },
  segmentButtonSelected: {
    backgroundColor: colors.surfaceCyanActive
  },
  monthButton: {
    minHeight: 50,
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha45
  },
  monthButtonSelected: {
    borderColor: colors.borderPinkGlow,
    backgroundColor: colors.surfacePinkActive
  },
  friendOption: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha45
  },
  friendOptionSelected: {
    borderColor: colors.borderCyanBright,
    backgroundColor: colors.surfaceCyanActive
  },
  contactInvitePanel: {
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderPinkMuted
  },
  friendName: {
    minWidth: 0,
    flexShrink: 1,
    fontFamily: fontFamilies.terminal
  },
  friendAlias: {
    flex: 1
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm
  },
  checkboxSelected: {
    borderColor: colors.cyan,
    backgroundColor: colors.cyan
  },
  lockedRegion: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderPinkMedium,
    borderRadius: radii.sm,
    backgroundColor: colors.surfacePinkGhost
  },
  lockedRegionCopy: {
    minWidth: 0,
    flex: 1
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs
  },
  weekdayButton: {
    minWidth: 0,
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha45
  },
  weekdayButtonSelected: {
    borderColor: colors.borderCyanBright,
    backgroundColor: colors.surfaceCyanActive
  },
  regionalDetailsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md
  },
  timeField: {
    minWidth: 0,
    flex: 1
  },
  validationNotice: {
    padding: spacing.md
  },
  cardList: {
    gap: spacing.md
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xs
  },
  listHeaderCopy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs
  },
  regionPill: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderPinkMedium,
    borderRadius: 16,
    backgroundColor: colors.surfacePinkGhost
  },
  challengeCard: {
    gap: spacing.md,
    padding: spacing.lg
  },
  challengeTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  activityIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanStrong,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceCyanSelected
  },
  activityIconPink: {
    borderColor: colors.borderPinkStrong,
    backgroundColor: colors.surfacePink
  },
  challengeHeading: {
    minWidth: 0,
    flex: 1,
    gap: 2
  },
  challengeName: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.cardTitle
  },
  statusPill: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSuccess,
    borderRadius: 14,
    backgroundColor: colors.surfaceSuccess
  },
  statusPillPending: {
    borderColor: colors.borderWarning,
    backgroundColor: colors.surfaceWarning
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green
  },
  statusDotPending: {
    backgroundColor: colors.amber
  },
  challengeMetaGrid: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderCyanHairline
  },
  metaItem: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  metaText: {
    minWidth: 0,
    flex: 1
  },
  metaAlias: {
    flex: 1
  },
  description: {
    fontFamily: fontFamilies.body
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  stackAvatar: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
    borderRadius: 15,
    backgroundColor: colors.surfaceCyanSelected
  },
  progressPanel: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSuccess,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceSuccess
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  progressValue: {
    marginTop: 2,
    fontSize: fontSizes.titleXl
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.whiteAlpha10,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.green
  },
  autoCountNotice: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSuccess,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceSuccess
  },
  autoCountText: {
    minWidth: 0,
    flex: 1
  },
  memberProgress: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderCyanHairline
  },
  memberProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  memberProgressName: {
    flexShrink: 1
  },
  memberProgressIdentity: {
    width: 132
  },
  memberProgressBar: {
    minWidth: 20,
    flex: 1
  },
  pendingPanel: {
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderWarning,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceWarning
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  flexButton: {
    flex: 1
  },
  fullWidthButton: {
    alignSelf: 'stretch'
  },
  compactButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radii.sm
  },
  invitePanel: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderCyanHairline
  },
  inviteRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  inviteIdentity: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  avatar: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanStrong,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceCyanSelected
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl
  },
  emptyBody: {
    textAlign: 'center'
  },
  pressed: {
    opacity: 0.72
  },
  disabled: {
    opacity: 0.42
  }
});
