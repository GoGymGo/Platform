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
    const input = normalizeSponsorApplication({ companyName, contactEmail, targetRegion });
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
      setSubmissionError('SPONSOR APPLICATION COULD NOT BE SENT. CHECK YOUR CONNECTION AND TRY AGAIN.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label="SPONSOR APPLICATION"
          onBack={() => goBackOrReplace(router, '/join')}
          progress={20}
          step="REGIONAL CAMPAIGN"
        />

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          SPONSOR A REGION
        </TerminalText>
        <TerminalText tone="muted" uppercase={false} variant="body">
          Reach verified GoGymGo members in a chosen region through sponsor
          placements that appear throughout the monthly competition.
        </TerminalText>

        <View style={styles.valueList}>
          <SponsorValue
            label="TARGETED REACH"
            value="REGION + COMMITMENT CATEGORY"
          />
          <SponsorValue
            label="CAMPAIGN PLACEMENTS"
            value="APP OPEN, CHECK-IN, COMPLETION + RANKS"
          />
          <SponsorValue
            label="REWARD FORMAT"
            value="PHYSICAL PRIZES + COUPON CODES"
          />
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
            placeholder="Toronto"
            value={targetRegion}
          />
          {submissionError ? (
            <AuthStatusNotice message={submissionError} tone="red" />
          ) : submitted ? (
            <AuthStatusNotice
              message="SPONSOR INTEREST RECORDED. GOGYMGO WILL CONNECT THIS FORM TO THE CAMPAIGN BACKEND BEFORE LAUNCH."
              tone="green"
            />
          ) : null}
          <CyberButtonPrimary
            disabled={submitting || submitted}
            label={submitted ? 'INTEREST RECORDED' : submitting ? 'RECORDING...' : 'APPLY AS A SPONSOR ->'}
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
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  title: {
    fontFamily: fontFamilies.display
  },
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
