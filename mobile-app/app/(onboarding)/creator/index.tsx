import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, spacing, fontSizes } from '@/constants/theme';

type CreatorChoice = 'solo' | 'apex' | 'luna' | 'titan';

type CreatorOption = {
  followers: string;
  handle: string;
  initials: string;
  key: Exclude<CreatorChoice, 'solo'>;
  name: string;
  styleLabel: string;
};

const creatorOptions: readonly CreatorOption[] = [
  {
    followers: '2.4M',
    handle: '@APEXFIT',
    initials: 'AX',
    key: 'apex',
    name: 'APEX ATHLETICS',
    styleLabel: 'HIIT & STRENGTH'
  },
  {
    followers: '880K',
    handle: '@LUNAMOVES',
    initials: 'LM',
    key: 'luna',
    name: 'LUNA MOVES',
    styleLabel: 'RUN CLUB'
  },
  {
    followers: '1.1M',
    handle: '@TITANLIFTS',
    initials: 'TL',
    key: 'titan',
    name: 'TITAN LIFTS',
    styleLabel: 'POWERLIFTING'
  }
];

export default function CreatorScreen() {
  const router = useRouter();
  const [selectedCreator, setSelectedCreator] = useState<CreatorChoice>('apex');

  return (
    <ScreenContainer>
      <SponsorBanner />
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepHeader}>
          <TerminalText tone="dim" variant="label">
            OPTIONAL CREATOR FEED
          </TerminalText>
          <TerminalText glow tone="cyan" variant="label">
            FOLLOW
          </TerminalText>
        </View>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          CHOOSE HOW YOU TRAIN
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" variant="body">
          TRAIN SOLO OR FOLLOW A LOCAL CREATOR WORKOUT. YOU CAN CHANGE THIS
          FROM PROFILE LATER.
        </TerminalText>

        <View style={styles.choiceList}>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selectedCreator === 'solo' }}
            onPress={() => setSelectedCreator('solo')}
          >
            <HUDBorderBox
              glow={selectedCreator === 'solo'}
              style={styles.choiceRow}
              tone={selectedCreator === 'solo' ? 'cyan' : 'muted'}
            >
              <View style={styles.soloMark}>
                <TerminalText glow tone="cyan" variant="label">
                  SO
                </TerminalText>
              </View>
              <View style={styles.choiceCopy}>
                <TerminalText tone="text" variant="body">
                  I'LL DO MY OWN WORKOUT
                </TerminalText>
                <TerminalText tone="muted" variant="micro">
                  SOLO // NO CREATOR FEED
                </TerminalText>
              </View>
              <RadioDot active={selectedCreator === 'solo'} />
            </HUDBorderBox>
          </Pressable>

          <TerminalText style={styles.followLabel} tone="dim" variant="label">
            FOLLOW A CREATOR
          </TerminalText>

          {creatorOptions.map((creator) => (
            <CreatorRow
              active={selectedCreator === creator.key}
              creator={creator}
              key={creator.key}
              onPress={() => setSelectedCreator(creator.key)}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <CyberButtonPrimary
            label="CONTINUE TO PERMISSIONS ->"
            onPress={() => router.push('/consents')}
          />
          <CyberButtonOutline
            label="TRAIN SOLO FOR NOW"
            onPress={() => router.push('/consents')}
          />
          <CyberButtonOutline
            label="BACK"
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function SponsorBanner() {
  return (
    <HUDBorderBox style={styles.sponsorBanner} tone="muted">
      <View style={styles.sponsorMark}>
        <TerminalText glow tone="pink" variant="title">
          V
        </TerminalText>
      </View>
      <View style={styles.sponsorCopy}>
        <TerminalText tone="dim" variant="micro">
          SPONSOR SIGNAL
        </TerminalText>
        <TerminalText style={styles.sponsorTitle} tone="text" variant="body">
          SPONSORED BY VOLT
        </TerminalText>
        <TerminalText tone="muted" variant="body">
          PRIZE POOL PARTNER
        </TerminalText>
      </View>
    </HUDBorderBox>
  );
}

function CreatorRow({
  active,
  creator,
  onPress
}: {
  active: boolean;
  creator: CreatorOption;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
    >
      <HUDBorderBox glow={active} style={styles.creatorRow} tone={active ? 'cyan' : 'muted'}>
        <View style={styles.creatorAvatar}>
          <TerminalText glow tone="cyan" variant="label">
            {creator.initials}
          </TerminalText>
        </View>
        <View style={styles.creatorCopy}>
          <View style={styles.creatorTitleRow}>
            <TerminalText glow={active} style={styles.choiceTitle} tone={active ? 'cyan' : 'text'} variant="body">
              {creator.name}
            </TerminalText>
            <View style={styles.verifiedBadge}>
              <TerminalText tone="cyan" variant="micro">
                VERIFIED
              </TerminalText>
            </View>
          </View>
          <TerminalText tone="muted" variant="micro">
            {creator.handle} // {creator.styleLabel}
          </TerminalText>
        </View>
        <View style={styles.followersBlock}>
          <TerminalText glow tone="cyan" variant="label">
            {creator.followers}
          </TerminalText>
          <TerminalText tone="dim" variant="micro">
            FOLLOWERS
          </TerminalText>
        </View>
      </HUDBorderBox>
    </Pressable>
  );
}

function RadioDot({ active }: { active: boolean }) {
  return (
    <View style={[styles.radioOuter, active ? styles.radioOuterActive : styles.radioOuterIdle]}>
      {active ? <View style={styles.radioInner} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sponsorBanner: {
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
    borderRadius: 8,
    backgroundColor: colors.surfacePink
  },
  sponsorCopy: {
    flex: 1
  },
  sponsorTitle: {
    marginTop: 1,
    fontFamily: fontFamilies.terminal
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  progressTrack: {
    height: 3,
    overflow: 'hidden',
    marginBottom: spacing.xxl,
    borderRadius: 2,
    backgroundColor: colors.whiteAlpha06
  },
  progressFill: {
    width: '40%',
    height: '100%',
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    lineHeight: 34,
    textAlign: 'center'
  },
  body: {
    marginTop: spacing.md,
    marginBottom: 22,
    fontFamily: fontFamilies.terminal
  },
  choiceList: {
    gap: spacing.md
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 13,
    paddingHorizontal: 15
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 13,
    paddingHorizontal: 15
  },
  soloMark: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyan,
    borderRadius: 12,
    backgroundColor: colors.surfaceCyanSubtle
  },
  choiceCopy: {
    flex: 1
  },
  choiceTitle: {
    fontFamily: fontFamilies.terminal
  },
  followLabel: {
    marginHorizontal: spacing.xs,
    marginTop: 2,
    marginBottom: -3,
    fontFamily: fontFamilies.terminal
  },
  creatorAvatar: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanActive,
    borderRadius: 12,
    backgroundColor: colors.surfaceCyanSelected
  },
  creatorCopy: {
    flex: 1
  },
  creatorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7
  },
  verifiedBadge: {
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: colors.borderCyanStrong,
    borderRadius: 6,
    backgroundColor: colors.surfaceCyanSoft
  },
  followersBlock: {
    alignItems: 'flex-end'
  },
  radioOuter: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 10
  },
  radioOuterActive: {
    borderColor: colors.cyan,
    ...cyberGlow.cyan
  },
  radioOuterIdle: {
    borderColor: colors.whiteAlpha15
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.cyan
  },
  actions: {
    marginTop: 22,
    gap: spacing.md
  }
});
