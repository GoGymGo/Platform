import { type Href, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, spacing, fontSizes } from '@/constants/theme';
import { shouldShowCreatorInvite } from '@/state/creatorInvitePreference';

type IdentityMode = 'anon' | 'alias' | 'real';

type IdentityOption = {
  desc: string;
  key: IdentityMode;
  marker: string;
  title: string;
};

const identityOptions: readonly IdentityOption[] = [
  {
    desc: 'USE A GENERATED CALLSIGN',
    key: 'anon',
    marker: 'AN',
    title: 'ANONYMOUS'
  },
  {
    desc: 'CHOOSE A PUBLIC HANDLE',
    key: 'alias',
    marker: '@',
    title: 'PUBLIC ALIAS'
  },
  {
    desc: 'SHOW YOUR DISPLAY NAME',
    key: 'real',
    marker: 'ID',
    title: 'REAL NAME'
  }
];

const callsignWords = [
  'PHANTOM',
  'IRON',
  'VOLT',
  'APEX',
  'NOVA',
  'TITAN',
  'SHADOW',
  'BLAZE',
  'RIFT',
  'GHOST',
  'SABLE',
  'ONYX',
  'FLUX',
  'VAPOR',
  'HAVOC'
] as const;

function generateCallsign() {
  const word = callsignWords[Math.floor(Math.random() * callsignWords.length)];
  const number = Math.floor(Math.random() * 9000) + 1000;
  return `${word}-${number}`;
}

export default function IdentityScreen() {
  const router = useRouter();
  const initialCallsign = useMemo(() => generateCallsign(), []);
  const [identityMode, setIdentityMode] = useState<IdentityMode>('anon');
  const [anonHandle, setAnonHandle] = useState(initialCallsign);
  const [aliasText, setAliasText] = useState('');
  const [nameText, setNameText] = useState('');

  const handleContinue = () => {
    if (shouldShowCreatorInvite()) {
      router.push('/creator/invite' as Href);
      return;
    }

    router.push('/creator');
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <SponsorBanner />
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stepHeader}>
            <TerminalText tone="dim" variant="label">
              STEP 01 / 04
            </TerminalText>
            <TerminalText glow tone="cyan" variant="label">
              USERNAME
            </TerminalText>
          </View>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>

          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            PUBLIC IDENTITY
          </TerminalText>
          <TerminalText style={styles.body} tone="muted" variant="body">
            CHOOSE HOW YOUR NAME APPEARS ON LEADERBOARDS, PAIRINGS AND WINNER
            ANNOUNCEMENTS. PAYOUT VERIFICATION STAYS PRIVATE.
          </TerminalText>

          <View style={styles.optionList}>
            {identityOptions.map((option) => (
              <IdentityOptionRow
                active={identityMode === option.key}
                key={option.key}
                onPress={() => setIdentityMode(option.key)}
                option={option}
              />
            ))}
          </View>

          {identityMode === 'anon' ? (
            <HUDBorderBox glow style={styles.callsignPanel} tone="cyan">
              <TerminalText tone="muted" variant="label">
                YOUR ASSIGNED CALLSIGN
              </TerminalText>
              <View style={styles.callsignRow}>
                <TerminalText glow style={styles.callsign} tone="cyan" variant="value">
                  {anonHandle}
                </TerminalText>
                <CyberButtonOutline
                  label="SHUFFLE"
                  onPress={() => setAnonHandle(generateCallsign())}
                  style={styles.shuffleButton}
                />
              </View>
            </HUDBorderBox>
          ) : null}

          {identityMode === 'alias' ? (
            <InputPanel
              helper="LETTERS, NUMBERS AND UNDERSCORES - MODERATED BEFORE IT GOES LIVE."
              label="CHOOSE YOUR HANDLE"
              onChangeText={setAliasText}
              placeholder="IRONWOLF"
              prefix="@"
              value={aliasText}
            />
          ) : null}

          {identityMode === 'real' ? (
            <InputPanel
              autoCapitalize="words"
              helper="SHOWN PUBLICLY ON LEADERBOARDS AND PAIRINGS."
              label="YOUR DISPLAY NAME"
              maxLength={30}
              onChangeText={setNameText}
              placeholder="ALEX RIVERA"
              prefix="ID"
              value={nameText}
            />
          ) : null}

          <View style={styles.actions}>
            <CyberButtonPrimary
              label="CONTINUE ->"
              onPress={handleContinue}
            />
            <CyberButtonOutline
              label="BACK"
              onPress={() => router.back()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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

function IdentityOptionRow({
  active,
  onPress,
  option
}: {
  active: boolean;
  onPress: () => void;
  option: IdentityOption;
}) {
  const tone = active ? 'cyan' : 'muted';

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
    >
      <HUDBorderBox glow={active} style={styles.optionRow} tone={tone}>
        <View style={[styles.optionMarker, active ? styles.optionMarkerActive : styles.optionMarkerIdle]}>
          <TerminalText glow={active} tone={active ? 'cyan' : 'dim'} variant="label">
            {option.marker}
          </TerminalText>
        </View>
        <View style={styles.optionCopy}>
          <TerminalText glow={active} style={styles.optionTitle} tone={active ? 'cyan' : 'text'} variant="body">
            {option.title}
          </TerminalText>
          <TerminalText tone="muted" variant="micro">
            {option.desc}
          </TerminalText>
        </View>
        <View style={[styles.radioOuter, active ? styles.radioOuterActive : styles.radioOuterIdle]}>
          {active ? <View style={styles.radioInner} /> : null}
        </View>
      </HUDBorderBox>
    </Pressable>
  );
}

function InputPanel({
  autoCapitalize = 'none',
  helper,
  label,
  maxLength = 18,
  onChangeText,
  placeholder,
  prefix,
  value
}: {
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  helper: string;
  label: string;
  maxLength?: number;
  onChangeText: (value: string) => void;
  placeholder: string;
  prefix: string;
  value: string;
}) {
  return (
    <HUDBorderBox glow style={styles.fieldGroup} tone="cyan">
      <TerminalText tone="muted" variant="label">
        {label}
      </TerminalText>
      <View style={styles.inputRow}>
        <TerminalText glow style={styles.inputPrefix} tone="cyan" variant="label">
          {prefix}
        </TerminalText>
        <TextInput
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.dim}
          style={styles.input}
          value={value}
        />
      </View>
      <TerminalText style={styles.helperText} tone="dim" variant="micro">
        {helper}
      </TerminalText>
    </HUDBorderBox>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.background
  },
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
    width: '25%',
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
    marginBottom: spacing.xxl,
    fontFamily: fontFamilies.terminal,
    textAlign: 'left'
  },
  optionList: {
    gap: spacing.md
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: spacing.lg
  },
  optionMarker: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10
  },
  optionMarkerActive: {
    borderColor: colors.borderCyanSelected,
    backgroundColor: colors.surfaceCyanSoft
  },
  optionMarkerIdle: {
    borderColor: colors.whiteAlpha10
  },
  optionCopy: {
    flex: 1
  },
  optionTitle: {
    fontFamily: fontFamilies.terminal,
    fontSize: fontSizes.control,
    lineHeight: 20
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
    borderColor: colors.cyan
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
  callsignPanel: {
    marginTop: 14,
    gap: spacing.md
  },
  callsignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  callsign: {
    flex: 1,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleLarge,
    lineHeight: 29
  },
  shuffleButton: {
    minHeight: 42,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  fieldGroup: {
    marginTop: 14,
    gap: spacing.sm
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.borderCyan,
    borderRadius: 12,
    backgroundColor: colors.panelAlpha50
  },
  inputPrefix: {
    minWidth: 22,
    fontFamily: fontFamilies.display,
    textAlign: 'center'
  },
  input: {
    flex: 1,
    minHeight: 48,
    color: colors.text,
    fontFamily: fontFamilies.terminal,
    fontSize: fontSizes.cardTitle
  },
  helperText: {
    fontFamily: fontFamilies.terminal
  },
  actions: {
    marginTop: 22,
    gap: spacing.md
  }
});
