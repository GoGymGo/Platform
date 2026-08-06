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
  hasGymRegistrationErrors,
  normalizeGymRegistration,
  validateGymRegistration,
  type GymRegistrationErrors
} from '@/domain/gymRegistration';
import { recordGymRegistrationRequest } from '@/services/gymRegistration';
import { useApi } from '@/state/api';

export default function GymRegistrationScreen() {
  const router = useRouter();
  const { api } = useApi();
  const [errors, setErrors] = useState<GymRegistrationErrors>({});
  const [gymAddress, setGymAddress] = useState('');
  const [gymName, setGymName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [region, setRegion] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submissionError, setSubmissionError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [workEmail, setWorkEmail] = useState('');

  async function submitRequest() {
    const input = normalizeGymRegistration({
      gymAddress,
      gymName,
      managerName,
      region,
      workEmail
    });
    const nextErrors = validateGymRegistration(input);
    setErrors(nextErrors);

    if (hasGymRegistrationErrors(nextErrors)) {
      return;
    }

    setSubmitting(true);
    setSubmissionError(undefined);
    try {
      await recordGymRegistrationRequest(api, input);
      setSubmitted(true);
    } catch {
      setSubmissionError(
        'GYM REGISTRATION COULD NOT BE SENT. CHECK YOUR CONNECTION AND TRY AGAIN.'
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
          label="PARTNER GYM"
          onBack={() => goBackOrReplace(router, '/join')}
          progress={20}
          step="QR CODE REQUEST"
        />

        <BrandScreenHeader
          description="Request a GoGymGo entry and exit QR-code set for one gym location. We review the location and manager details before activation."
          eyebrow="PARTNER GYM"
          title="REGISTER A GYM"
        />

        <View style={styles.processList}>
          <ProcessRow index="01" text="SUBMIT ONE GYM LOCATION" />
          <ProcessRow index="02" text="GOGYMGO REVIEWS THE LOCATION" />
          <ProcessRow index="03" text="APPROVED GYMS RECEIVE ENTRY + EXIT QR CODES" />
        </View>

        <HUDBorderBox style={styles.form} tone="cyan">
          <AuthTextField
            error={errors.gymName}
            label="GYM NAME"
            onChangeText={setGymName}
            placeholder="Your gym"
            value={gymName}
          />
          <AuthTextField
            error={errors.managerName}
            label="GYM MANAGER NAME"
            onChangeText={setManagerName}
            placeholder="Full name"
            value={managerName}
          />
          <AuthTextField
            autoCapitalize="none"
            autoComplete="email"
            error={errors.workEmail}
            keyboardType="email-address"
            label="MANAGER WORK EMAIL"
            onChangeText={setWorkEmail}
            placeholder="manager@gym.com"
            value={workEmail}
          />
          <AuthTextField
            error={errors.gymAddress}
            label="GYM STREET ADDRESS"
            onChangeText={setGymAddress}
            placeholder="One physical location"
            value={gymAddress}
          />
          <AuthTextField
            error={errors.region}
            label="CITY / REGION"
            onChangeText={setRegion}
            placeholder="Nanaimo"
            value={region}
          />
          {submissionError ? (
            <AuthStatusNotice message={submissionError} tone="red" />
          ) : submitted ? (
            <AuthStatusNotice
              message="GYM QR REQUEST RECORDED. GOGYMGO WILL VERIFY THIS LOCATION BEFORE ISSUING OR ACTIVATING ANY QR CODES."
              tone="green"
            />
          ) : null}
          <DataCollectionNotice message="We use the manager contact and gym-location details to review this QR request, verify the location, prevent misuse and contact the applicant. They are not added to a marketing list through this form." />
          <CyberButtonPrimary
            disabled={submitting || submitted}
            label={
              submitted
                ? 'REQUEST RECORDED'
                : submitting
                  ? 'RECORDING...'
                  : 'REQUEST GYM QR CODES ->'
            }
            onPress={submitRequest}
          />
        </HUDBorderBox>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function ProcessRow({ index, text }: { index: string; text: string }) {
  return (
    <View style={styles.processRow}>
      <TerminalText tone="cyan" variant="micro">
        {index}
      </TerminalText>
      <TerminalText style={styles.processText} tone="text" variant="body">
        {text}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  processList: {
    borderTopWidth: 1,
    borderColor: colors.borderCyanSubtle
  },
  processRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.borderCyanSubtle
  },
  processText: {
    flex: 1,
    fontFamily: fontFamilies.body
  },
  form: {
    gap: spacing.md,
    padding: spacing.lg
  }
});
