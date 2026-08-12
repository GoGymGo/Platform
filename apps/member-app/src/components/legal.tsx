import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  ScreenScrollView,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { FirstRunSecondaryButton } from '@/components/firstRun';
import { OnboardingHeader } from '@/components/onboarding';
import { BrandScreenHeader, brandScreenStyles } from '@/components/screenLayout';
import { biometricConsentCopy, type LegalDocument } from '@/constants/legal';
import { colors, fontFamilies, radii, spacing } from '@/constants/theme';
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
  compact?: boolean;
  jurisdictionCode?: string;
  locale?: string;
  style?: StyleProp<ViewStyle>;
};

type DataCollectionNoticeProps = {
  message: string;
  style?: StyleProp<ViewStyle>;
};

type LegalDocumentScreenProps = {
  document: LegalDocument;
};

function formatReadableLegalCopy(value: string) {
  return value
    .toLowerCase()
    .replace(
      /(^|[.!?]\s+)([a-z])/g,
      (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`
    )
    .replace(/\bgogymgo\b/gi, 'GoGymGo')
    .replace(/\bqr\b/gi, 'QR')
    .replace(/\bface id\b/gi, 'Face ID')
    .replace(/\btouch id\b/gi, 'Touch ID')
    .replace(/\bcad\b/gi, 'CAD')
    .replace(/\bbc\b/gi, 'BC')
    .replace(/\bpdt\b/gi, 'PDT')
    .replace(/\bai\b/gi, 'AI')
    .replace(/\bid\b/gi, 'ID')
    .replace(/\bos\b/gi, 'OS')
    .replace(/\bcanada\b/gi, 'Canada')
    .replace(/\bbritish columbia\b/gi, 'British Columbia')
    .replace(/\bvancouver island\b/gi, 'Vancouver Island')
    .replace(/\bgulf islands\b/gi, 'Gulf Islands')
    .replace(/\bprivacy policy\b/gi, 'Privacy Policy')
    .replace(/\bofficial contest rules\b/gi, 'Official Contest Rules')
    .replace(/\bweekly goal\b/gi, 'Weekly Goal')
    .replace(/\bcalifornia\b/gi, 'California');
}

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
      aria-checked={checked}
      aria-label={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={style}
    >
      <HUDBorderBox style={styles.checkboxRow} tone={activeTone}>
        <View
          style={[
            styles.checkboxMark,
            checked ? styles.checkboxMarkActive : styles.checkboxMarkIdle
          ]}
        >
          {checked ? (
            <TerminalText tone={tone} variant="micro">
              OK
            </TerminalText>
          ) : null}
        </View>
        <View style={styles.checkboxCopy}>
          <TerminalText style={styles.checkboxLabel} tone={textTone} variant="body">
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

export function LegalDocumentLinks({
  compact = false,
  jurisdictionCode = 'GLOBAL',
  locale = 'en',
  style
}: LegalDocumentLinksProps) {
  const router = useRouter();
  const openDocument = (pathname: '/privacy-policy' | '/terms-of-service') =>
    router.push({
      pathname,
      params: { jurisdictionCode, locale }
    } as Href);

  if (compact) {
    return (
      <View style={[styles.compactLinkRow, style]}>
        <Pressable
          accessibilityRole="link"
          onPress={() => openDocument('/privacy-policy')}
          style={({ pressed }) => [styles.compactLink, pressed ? styles.pressed : null]}
        >
          <TerminalText tone="cyan" variant="micro">
            PRIVACY POLICY
          </TerminalText>
        </Pressable>
        <TerminalText tone="dim" variant="micro">
          {'//'}
        </TerminalText>
        <Pressable
          accessibilityRole="link"
          onPress={() => openDocument('/terms-of-service')}
          style={({ pressed }) => [styles.compactLink, pressed ? styles.pressed : null]}
        >
          <TerminalText tone="cyan" variant="micro">
            TERMS
          </TerminalText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.linkRow, style]}>
      <FirstRunSecondaryButton
        label="PRIVACY POLICY"
        onPress={() => openDocument('/privacy-policy')}
        style={styles.linkButton}
      />
      <FirstRunSecondaryButton
        label="TERMS"
        onPress={() => openDocument('/terms-of-service')}
        style={styles.linkButton}
      />
    </View>
  );
}

export function DataCollectionNotice({ message, style }: DataCollectionNoticeProps) {
  return (
    <HUDBorderBox style={[styles.dataNotice, style]} tone="muted">
      <TerminalText glow tone="cyan" variant="micro">
        HOW WE USE THIS INFORMATION
      </TerminalText>
      <TerminalText tone="muted" uppercase={false} variant="caption">
        {message}
      </TerminalText>
      <LegalDocumentLinks compact />
    </HUDBorderBox>
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
    ? 'Your phone handles the presence check. GoGymGo receives only a pass or fail result, never biometric data.'
    : biometricConsentCopy.body;

  if (compact && checked) {
    return (
      <HUDBorderBox style={[styles.cameraBannerAccepted, style]} tone="muted">
        <View style={styles.acceptedCopy}>
          <TerminalText glow tone="green" variant="label">
            SECURE CHECK READY
          </TerminalText>
        </View>
        <Pressable
          accessibilityLabel="Learn more about device verification"
          accessibilityRole="button"
          onPress={() => router.push('/biometric-camera-consent' as Href)}
          style={({ pressed }) => [styles.policyButton, pressed ? styles.pressed : null]}
        >
          <TerminalText glow tone="cyan" variant="micro">
            WHY?
          </TerminalText>
        </Pressable>
      </HUDBorderBox>
    );
  }

  return (
    <HUDBorderBox
      glow={checked}
      style={[styles.cameraBanner, style]}
      tone={checked ? 'cyan' : 'muted'}
    >
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
      <View style={styles.documentNav}>
        <OnboardingHeader
          label="LEGAL DOCUMENT"
          onBack={() => goBackOrReplace(router, '/')}
          step="GOGYMGO"
        />
      </View>

      <ScreenScrollView
        bounces={false}
        contentContainerStyle={[brandScreenStyles.content, styles.documentContent]}
        showsVerticalScrollIndicator={false}
      >
        <BrandScreenHeader
          description={formatReadableLegalCopy(document.intro)}
          eyebrow={`EFFECTIVE // ${document.effectiveDate}`}
          title={document.title}
        />

        <HUDBorderBox style={styles.documentIntro} tone="cyan">
          <TerminalText tone="dim" variant="micro">
            PLAIN-LANGUAGE SUMMARY
          </TerminalText>
          <TerminalText style={styles.documentIntroCopy} tone="muted" variant="body">
            Read the sections below for the complete published terms.
          </TerminalText>
        </HUDBorderBox>

        <View style={styles.sectionList}>
          {document.sections.map((section) => (
            <HUDBorderBox key={section.heading} style={styles.legalSection} tone="muted">
              <TerminalText style={styles.sectionHeading} tone="cyan" variant="label">
                {section.heading}
              </TerminalText>
              {section.body ? (
                <TerminalText style={styles.sectionBody} tone="muted" variant="body">
                  {formatReadableLegalCopy(section.body)}
                </TerminalText>
              ) : null}
              {section.bullets ? (
                <View style={styles.bulletList}>
                  {section.bullets.map((bullet) => (
                    <View key={bullet} style={styles.bulletRow}>
                      <View style={styles.bulletDot} />
                      <TerminalText style={styles.bulletText} tone="muted" variant="body">
                        {formatReadableLegalCopy(bullet)}
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
  dataNotice: {
    gap: spacing.sm,
    padding: spacing.md
  },
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
    backgroundColor: colors.surfaceCyanSelected
  },
  checkboxMarkIdle: {
    borderColor: colors.borderMuted,
    backgroundColor: colors.whiteAlpha05
  },
  checkboxCopy: {
    flex: 1
  },
  checkboxLabel: {
    fontFamily: fontFamilies.ui,
    fontSize: 15,
    lineHeight: 22
  },
  checkboxHelper: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.ui,
    fontSize: 14,
    lineHeight: 21
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
  compactLinkRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs
  },
  compactLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm
  },
  cameraBanner: {
    gap: spacing.sm,
    padding: spacing.md
  },
  cameraBannerAccepted: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  acceptedCopy: {
    minWidth: 0,
    flex: 1,
    gap: 2
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
  documentNav: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm
  },
  documentContent: {
    paddingTop: 0
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
    backgroundColor: colors.cyan
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
