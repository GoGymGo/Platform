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
import { BiometricCameraConsentBanner, LegalDocumentLinks } from '@/components/legal';
import { colors, cyberGlow, fontFamilies, spacing, fontSizes } from '@/constants/theme';

type ConsentKey = 'bio' | 'health' | 'location';

type ConsentState = Record<ConsentKey, boolean>;

type ConsentRow = {
  desc: string;
  key: ConsentKey;
  marker: string;
  title: string;
};

const consentRows: readonly ConsentRow[] = [
  {
    desc: 'USED ONLY TO CONFIRM YOU ARE PRESENT AT CHECKPOINTS',
    key: 'bio',
    marker: 'ID',
    title: 'IDENTITY CHECK'
  },
  {
    desc: 'HEART-RATE OR GYM QR DATA VALIDATES SESSION EFFORT AND DURATION',
    key: 'health',
    marker: 'DATA',
    title: 'WORKOUT DATA'
  },
  {
    desc: 'PLACES YOU IN THE RIGHT LOCAL PRIZE DRAW',
    key: 'location',
    marker: 'RG',
    title: 'REGION'
  }
];

const initialConsents: ConsentState = {
  bio: true,
  health: true,
  location: true
};

export default function ConsentsScreen() {
  const router = useRouter();
  const [consents, setConsents] = useState<ConsentState>(initialConsents);
  const [biometricConsentAccepted, setBiometricConsentAccepted] = useState(false);
  const requiredConsentsAccepted =
    Object.values(consents).every(Boolean) && biometricConsentAccepted;

  const toggleConsent = (key: ConsentKey) => {
    setConsents((current) => ({
      ...current,
      [key]: !current[key]
    }));
  };

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
            STEP 02 / 04
          </TerminalText>
          <TerminalText glow tone="cyan" variant="label">
            PERMISSIONS
          </TerminalText>
        </View>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          WHAT WE NEED TO VERIFY YOU
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" variant="body">
          THESE PERMISSIONS ONLY VALIDATE ELIGIBLE WORKOUTS AND PLACE YOU IN THE
          RIGHT PRIZE DRAW. FACE ID CONFIRMS PRESENCE ONLY; GOGYMGO STORES THE
          CHECKPOINT RESULT, NOT THE SCAN.
        </TerminalText>

        <LegalDocumentLinks style={styles.legalLinks} />

        <View style={styles.consentList}>
          {consentRows.map((row) => (
            <ConsentToggleRow
              enabled={consents[row.key]}
              key={row.key}
              onToggle={() => toggleConsent(row.key)}
              row={row}
            />
          ))}
        </View>

        <BiometricCameraConsentBanner
          checked={biometricConsentAccepted}
          onToggle={() => setBiometricConsentAccepted((current) => !current)}
          style={styles.cameraConsent}
        />

        <View style={styles.actions}>
          <CyberButtonPrimary
            disabled={!requiredConsentsAccepted}
            label="ALLOW & CONTINUE ->"
            onPress={() => router.push('/verification')}
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

function ConsentToggleRow({
  enabled,
  onToggle,
  row
}: {
  enabled: boolean;
  onToggle: () => void;
  row: ConsentRow;
}) {
  return (
    <HUDBorderBox glow={enabled} style={styles.consentRow} tone={enabled ? 'cyan' : 'muted'}>
      <View style={styles.consentMarker}>
        <TerminalText glow={enabled} tone={enabled ? 'cyan' : 'dim'} variant="label">
          {row.marker}
        </TerminalText>
      </View>
      <View style={styles.consentCopy}>
        <TerminalText glow={enabled} style={styles.consentTitle} tone={enabled ? 'cyan' : 'text'} variant="body">
          {row.title}
        </TerminalText>
        <TerminalText tone="muted" variant="micro">
          {row.desc}
        </TerminalText>
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled }}
        onPress={onToggle}
        style={[styles.switchTrack, enabled ? styles.switchTrackOn : styles.switchTrackOff]}
      >
        <View
          style={[
            styles.switchKnob,
            enabled ? styles.switchKnobOn : styles.switchKnobOff
          ]}
        />
      </Pressable>
    </HUDBorderBox>
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
    width: '50%',
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
  consentList: {
    gap: 11
  },
  legalLinks: {
    marginBottom: spacing.md
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: 15
  },
  consentMarker: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanLight,
    borderRadius: 10
  },
  consentCopy: {
    flex: 1,
    gap: 1
  },
  consentTitle: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.button,
    lineHeight: 18
  },
  switchTrack: {
    width: 42,
    height: 24,
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderRadius: 13
  },
  switchTrackOn: {
    alignItems: 'flex-end',
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  switchTrackOff: {
    alignItems: 'flex-start',
    backgroundColor: colors.whiteAlpha12
  },
  switchKnob: {
    width: 18,
    height: 18,
    borderRadius: 9
  },
  switchKnobOn: {
    backgroundColor: colors.textOnPrimary
  },
  switchKnobOff: {
    backgroundColor: colors.textDisabled
  },
  actions: {
    gap: spacing.md,
    marginTop: 22
  },
  cameraConsent: {
    marginTop: spacing.md
  }
});
