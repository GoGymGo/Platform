import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { biometricConsentCopy, type LegalDocument } from '@/constants/legal';
import { colors, cyberGlow, fontFamilies, radii, spacing } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';

type LegalTone = 'cyan' | 'pink';

type LegalConsentCheckboxProps = {
  checked: boolean;
  helper?: string;
  label: string;
  onToggle: () => void;
  style?: StyleProp<ViewStyle>;
  tone?: LegalTone;
};

type BiometricCameraConsentBannerProps = {
  checked: boolean;
  compact?: boolean;
  onToggle: () => void;
  style?: StyleProp<ViewStyle>;
};

type LegalDocumentLinksProps = {
  style?: StyleProp<ViewStyle>;
};

type LegalDocumentScreenProps = {
  document: LegalDocument;
};

export function LegalConsentCheckbox({
  checked,
  helper,
  label,
  onToggle,
  style,
  tone = 'cyan'
}: LegalConsentCheckboxProps) {
  const activeTone = checked ? tone : 'muted';
  const textTone = checked ? tone : 'text';

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={style}
    >
      <HUDBorderBox glow={checked} style={styles.checkboxRow} tone={activeTone}>
        <View style={[styles.checkboxMark, checked ? styles.checkboxMarkActive : styles.checkboxMarkIdle]}>
          {checked ? (
            <TerminalText glow tone={tone} variant="micro">
              OK
            </TerminalText>
          ) : null}
        </View>
        <View style={styles.checkboxCopy}>
          <TerminalText glow={checked} style={styles.checkboxLabel} tone={textTone} variant="body">
            {label}
          </TerminalText>
          {helper ? (
            <TerminalText style={styles.checkboxHelper} tone="muted" variant="caption">
              {helper}
            </TerminalText>
          ) : null}
        </View>
      </HUDBorderBox>
    </Pressable>
  );
}

export function LegalDocumentLinks({ style }: LegalDocumentLinksProps) {
  const router = useRouter();

  return (
    <View style={[styles.linkRow, style]}>
      <CyberButtonOutline
        label="PRIVACY POLICY"
        onPress={() => router.push('/privacy-policy' as Href)}
        style={styles.linkButton}
      />
      <CyberButtonOutline
        label="TERMS"
        onPress={() => router.push('/terms-of-service' as Href)}
        style={styles.linkButton}
      />
    </View>
  );
}

export function BiometricCameraConsentBanner({
  checked,
  compact = false,
  onToggle,
  style
}: BiometricCameraConsentBannerProps) {
  const router = useRouter();
  const bannerBody = compact
    ? 'Local presence check only. No biometric data, camera frames or imagery is stored or transmitted.'
    : biometricConsentCopy.body;

  if (compact && checked) {
    return (
      <HUDBorderBox glow style={[styles.cameraBannerAccepted, style]} tone="cyan">
        <View style={styles.acceptedStatus}>
          <TerminalText glow tone="green" variant="label">
            CONSENT ON FILE
          </TerminalText>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/biometric-camera-consent' as Href)}
            style={({ pressed }) => [styles.policyButton, pressed ? styles.pressed : null]}
          >
            <TerminalText glow tone="cyan" variant="micro">
              VIEW NOTICE
            </TerminalText>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onToggle}
          style={({ pressed }) => [styles.withdrawButton, pressed ? styles.pressed : null]}
        >
          <TerminalText tone="dim" variant="micro">
            WITHDRAW CONSENT
          </TerminalText>
        </Pressable>
      </HUDBorderBox>
    );
  }

  return (
    <HUDBorderBox glow={checked} style={[styles.cameraBanner, style]} tone={checked ? 'cyan' : 'muted'}>
      <View style={styles.bannerHeader}>
        <TerminalText glow={checked} tone={checked ? 'cyan' : 'dim'} variant="label">
          {biometricConsentCopy.title}
        </TerminalText>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/biometric-camera-consent' as Href)}
          style={({ pressed }) => [styles.policyButton, pressed ? styles.pressed : null]}
        >
          <TerminalText glow tone="cyan" variant="micro">
            VIEW NOTICE
          </TerminalText>
        </Pressable>
      </View>
      <TerminalText style={styles.bannerCopy} tone="muted" uppercase={false} variant="caption">
        {bannerBody}
      </TerminalText>
      <LegalConsentCheckbox
        checked={checked}
        label={biometricConsentCopy.checkbox}
        onToggle={onToggle}
        style={styles.bannerCheckbox}
      />
    </HUDBorderBox>
  );
}

export function LegalDocumentScreen({ document }: LegalDocumentScreenProps) {
  const router = useRouter();

  return (
    <ScreenContainer>
      <View style={styles.documentHeader}>
        <View style={styles.documentTitleGroup}>
          <TerminalText glow tone="cyan" variant="label">
            LEGAL DOCUMENT
          </TerminalText>
          <TerminalText style={styles.documentTitle} tone="text" variant="title">
            {document.title}
          </TerminalText>
        </View>
        <CyberButtonOutline
          label="CLOSE"
          onPress={() => goBackOrReplace(router, '/')}
          style={styles.closeButton}
        />
      </View>

      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.documentContent}
        showsVerticalScrollIndicator={false}
      >
        <HUDBorderBox glow style={styles.documentIntro} tone="cyan">
          <TerminalText tone="dim" variant="micro">
            EFFECTIVE // {document.effectiveDate}
          </TerminalText>
          <TerminalText style={styles.documentIntroCopy} tone="cyan" variant="body">
            {document.intro}
          </TerminalText>
        </HUDBorderBox>

        <View style={styles.sectionList}>
          {document.sections.map((section) => (
            <HUDBorderBox key={section.heading} style={styles.legalSection} tone="muted">
              <TerminalText glow style={styles.sectionHeading} tone="cyan" variant="label">
                {section.heading}
              </TerminalText>
              {section.body ? (
                <TerminalText style={styles.sectionBody} tone="muted" variant="body">
                  {section.body}
                </TerminalText>
              ) : null}
              {section.bullets ? (
                <View style={styles.bulletList}>
                  {section.bullets.map((bullet) => (
                    <View key={bullet} style={styles.bulletRow}>
                      <View style={styles.bulletDot} />
                      <TerminalText style={styles.bulletText} tone="muted" variant="body">
                        {bullet}
                      </TerminalText>
                    </View>
                  ))}
                </View>
              ) : null}
            </HUDBorderBox>
          ))}
        </View>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md
  },
  checkboxMark: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 7
  },
  checkboxMarkActive: {
    borderColor: colors.borderCyanGlow,
    backgroundColor: colors.surfaceCyanSelected,
    ...cyberGlow.cyan
  },
  checkboxMarkIdle: {
    borderColor: colors.borderMuted,
    backgroundColor: colors.whiteAlpha05
  },
  checkboxCopy: {
    flex: 1
  },
  checkboxLabel: {
    fontFamily: fontFamilies.body
  },
  checkboxHelper: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.body
  },
  linkRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  linkButton: {
    flex: 1,
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm
  },
  cameraBanner: {
    gap: spacing.sm,
    padding: spacing.md
  },
  cameraBannerAccepted: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  acceptedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  policyButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderCyanButton,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceCyanGhost
  },
  withdrawButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingRight: spacing.md
  },
  bannerCopy: {
    fontFamily: fontFamilies.body
  },
  bannerCheckbox: {
    marginTop: spacing.xs
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteAlpha07,
    backgroundColor: colors.background
  },
  documentTitleGroup: {
    flex: 1
  },
  documentTitle: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display
  },
  closeButton: {
    width: 104,
    minHeight: 44,
    paddingVertical: spacing.sm
  },
  documentContent: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  documentIntro: {
    marginBottom: spacing.lg
  },
  documentIntroCopy: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.body
  },
  sectionList: {
    gap: spacing.md
  },
  legalSection: {
    padding: spacing.lg
  },
  sectionHeading: {
    fontFamily: fontFamilies.display
  },
  sectionBody: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.body
  },
  bulletList: {
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  bulletDot: {
    width: 6,
    height: 6,
    marginTop: 7,
    borderRadius: 3,
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  bulletText: {
    flex: 1,
    fontFamily: fontFamilies.body
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
