import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { DataCollectionNotice } from '@/components/legal';
import { BrandScreenHeader, brandScreenStyles } from '@/components/screenLayout';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';
import {
  hasSponsorApplicationErrors,
  normalizeSponsorApplication,
  validateSponsorApplication,
  type SponsorApplicationErrors
} from '@/domain/sponsorApplication';
import { recordSponsorApplication } from '@/services/sponsorApplication';
import { useApi } from '@/state/api';
import { useCompetitionRegion } from '@/state/competitionRegion';

export default function SponsorApplicationScreen() {
  const router = useRouter();
  const { api } = useApi();
  const { competitionRegion } = useCompetitionRegion();
  const [companyName, setCompanyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [errors, setErrors] = useState<SponsorApplicationErrors>({});
  const [submissionError, setSubmissionError] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [targetRegion, setTargetRegion] = useState(competitionRegion.label);

  async function submitApplication() {
    const input = normalizeSponsorApplication({
      companyName,
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
      await recordSponsorApplication(api, input);
      setSubmitted(true);
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
          description="Support a regional GoGymGo competition through approved prizes and participant rewards."
          eyebrow="REGIONAL CAMPAIGN"
          title="SPONSOR A REGION"
        />

        <View style={styles.valueList}>
          <SponsorValue label="TARGETED REACH" value="REGION + COMPETITION COMMUNITY" />
          <SponsorValue
            label="PARTNERSHIP OPTIONS"
            value="COMPETITION REWARDS"
          />
          <SponsorValue label="REWARD FORMAT" value="PHYSICAL PRIZES + COUPON CODES" />
        </View>

        <HUDBorderBox style={styles.form} tone="cyan">
          <AuthTextField
            error={errors.companyName}
            label="COMPANY NAME"
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
            onChangeText={setContactEmail}
            placeholder="name@company.com"
            value={contactEmail}
          />
          <AuthTextField
            error={errors.targetRegion}
            label="TARGET REGION"
            onChangeText={setTargetRegion}
            placeholder="Nanaimo"
            value={targetRegion}
          />
          {submissionError ? (
            <AuthStatusNotice message={submissionError} tone="red" />
          ) : submitted ? (
            <AuthStatusNotice
              message="APPLICATION SUBMITTED. THE GOGYMGO TEAM WILL REVIEW IT AND FOLLOW UP BY EMAIL."
              tone="green"
            />
          ) : null}
          <DataCollectionNotice message="We use these business contact details to review this sponsor request, prevent misuse and contact you about the requested partnership. They are not added to a marketing list through this form." />
          <CyberButtonPrimary
            disabled={submitting || submitted}
            label={
              submitted
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
