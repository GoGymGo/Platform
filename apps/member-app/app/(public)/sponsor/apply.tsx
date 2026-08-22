import { useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthStatusNotice, AuthTextField } from '@/components/auth';
import {
  ScreenScrollView,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { OnboardingHeader } from '@/components/onboarding';
import { DataCollectionNotice, LegalConsentCheckbox } from '@/components/legal';
import { BrandScreenHeader, brandScreenStyles } from '@/components/screenLayout';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';
import {
  hasSponsorApplicationErrors,
  normalizeSponsorApplication,
  validateSponsorApplication,
  type SponsorApplicationErrors
} from '@/domain/sponsorApplication';
import { partnerApplicationReceiptMessage } from '@/domain/partnerApplicationReceipt';
import { recordSponsorApplication } from '@/services/sponsorApplication';
import { useApi } from '@/state/api';
import { useCompetitionRegion } from '@/state/competitionRegion';

export default function SponsorApplicationScreen() {
  const router = useRouter();
  const { api } = useApi();
  const { competitionRegion } = useCompetitionRegion();
  const [companyName, setCompanyName] = useState('');
  const [consent, setConsent] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [errors, setErrors] = useState<SponsorApplicationErrors>({});
  const [submissionError, setSubmissionError] = useState<string>();
  const [receiptMessage, setReceiptMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [targetRegion, setTargetRegion] = useState(competitionRegion.label);
  const retry = useRef<{ key: string; signature: string } | undefined>(undefined);

  async function submitApplication() {
    const input = normalizeSponsorApplication({
      companyName,
      consent,
      contactEmail,
      targetRegion
    });
    const nextErrors = validateSponsorApplication(input);
    setErrors(nextErrors);

    if (hasSponsorApplicationErrors(nextErrors)) {
      return;
    }

    setSubmitting(true);
    setSubmissionError(undefined);
    try {
      const signature = JSON.stringify(input);
      if (retry.current?.signature !== signature) {
        retry.current = { key: `partner-sponsor:${randomUUID()}`, signature };
      }
      const receipt = await recordSponsorApplication(api, input, retry.current.key);
      setReceiptMessage(partnerApplicationReceiptMessage(receipt));
    } catch {
      setSubmissionError(
        'SPONSOR APPLICATION COULD NOT BE SENT. CHECK YOUR CONNECTION AND TRY AGAIN.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={brandScreenStyles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label="SPONSOR APPLICATION"
          onBack={() => goBackOrReplace(router, '/join')}
          progress={20}
          step="REGIONAL CAMPAIGN"
        />

        <BrandScreenHeader
          accent="pink"
          description="Support a regional GoGymGo contest through approved prizes and participant rewards."
          eyebrow="REGIONAL CAMPAIGN"
          title="SPONSOR A REGION"
        />

        <View style={styles.valueList}>
          <SponsorValue label="TARGETED REACH" value="REGION + CONTEST COMMUNITY" />
          <SponsorValue
            label="PARTNERSHIP OPTIONS"
            value="CONTEST REWARDS"
          />
          <SponsorValue label="REWARD FORMAT" value="PHYSICAL PRIZES + COUPON CODES" />
        </View>

        <HUDBorderBox style={styles.form} tone="cyan">
          <AuthTextField
            error={errors.companyName}
            label="COMPANY NAME"
            maxLength={160}
            onChangeText={setCompanyName}
            placeholder="Your organization"
            value={companyName}
          />
          <AuthTextField
            autoCapitalize="none"
            autoComplete="email"
            error={errors.contactEmail}
            keyboardType="email-address"
            label="WORK EMAIL"
            maxLength={320}
            onChangeText={setContactEmail}
            placeholder="name@company.com"
            value={contactEmail}
          />
          <AuthTextField
            error={errors.targetRegion}
            label="TARGET REGION"
            maxLength={120}
            onChangeText={setTargetRegion}
            placeholder="Nanaimo"
            value={targetRegion}
          />
          {submissionError ? (
            <AuthStatusNotice message={submissionError} tone="red" />
          ) : receiptMessage ? (
            <AuthStatusNotice message={receiptMessage} tone="green" />
          ) : null}
          <DataCollectionNotice message="We use these business contact details to review this sponsor request, prevent misuse and contact you about the requested partnership. They are not added to a marketing list through this form." />
          <LegalConsentCheckbox
            checked={consent}
            helper={errors.consent}
            label="I consent to GoGymGo storing these details for the disclosed intake and retention period."
            onToggle={() => setConsent((current) => !current)}
          />
          <CyberButtonPrimary
            disabled={submitting || Boolean(receiptMessage)}
            label={
              receiptMessage
                ? 'INTEREST RECORDED'
                : submitting
                  ? 'RECORDING...'
                  : 'APPLY AS A SPONSOR ->'
            }
            onPress={submitApplication}
          />
        </HUDBorderBox>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function SponsorValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.valueRow}>
      <TerminalText tone="dim" variant="micro">
        {label}
      </TerminalText>
      <TerminalText style={styles.valueText} tone="text" variant="body">
        {value}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  valueList: {
    borderTopWidth: 1,
    borderColor: colors.borderCyanSubtle
  },
  valueRow: {
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.borderCyanSubtle
  },
  valueText: {
    fontFamily: fontFamilies.body
  },
  form: {
    gap: spacing.md,
    padding: spacing.lg
  }
});
