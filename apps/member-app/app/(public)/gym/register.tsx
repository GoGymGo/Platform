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
  hasGymRegistrationErrors,
  normalizeGymRegistration,
  validateGymRegistration,
  type GymRegistrationErrors
} from '@/domain/gymRegistration';
import { partnerApplicationReceiptMessage } from '@/domain/partnerApplicationReceipt';
import { recordGymRegistrationRequest } from '@/services/gymRegistration';
import { useApi } from '@/state/api';

export default function GymRegistrationScreen() {
  const router = useRouter();
  const { api } = useApi();
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<GymRegistrationErrors>({});
  const [gymAddress, setGymAddress] = useState('');
  const [gymName, setGymName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [region, setRegion] = useState('');
  const [receiptMessage, setReceiptMessage] = useState<string>();
  const [submissionError, setSubmissionError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [workEmail, setWorkEmail] = useState('');
  const retry = useRef<{ key: string; signature: string } | undefined>(undefined);

  async function submitRequest() {
    const input = normalizeGymRegistration({
      consent,
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
      const signature = JSON.stringify(input);
      if (retry.current?.signature !== signature) {
        retry.current = { key: `partner-gym:${randomUUID()}`, signature };
      }
      const receipt = await recordGymRegistrationRequest(api, input, retry.current.key);
      setReceiptMessage(partnerApplicationReceiptMessage(receipt));
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
          description="Request one GoGymGo Contest QR for a gym location. Players use it once to select the gym, then verify workouts with live location."
          eyebrow="PARTNER GYM"
          title="REGISTER A GYM"
        />

        <View style={styles.processList}>
          <ProcessRow index="01" text="SUBMIT ONE GYM LOCATION" />
          <ProcessRow index="02" text="GOGYMGO REVIEWS THE LOCATION" />
          <ProcessRow index="03" text="A SEPARATE APPROVAL + ACTIVATION DECISION IS REQUIRED" />
        </View>

        <HUDBorderBox style={styles.form} tone="cyan">
          <AuthTextField
            error={errors.gymName}
            label="GYM NAME"
            maxLength={160}
            onChangeText={setGymName}
            placeholder="Your gym"
            value={gymName}
          />
          <AuthTextField
            error={errors.managerName}
            label="GYM MANAGER NAME"
            maxLength={160}
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
            maxLength={320}
            onChangeText={setWorkEmail}
            placeholder="manager@gym.com"
            value={workEmail}
          />
          <AuthTextField
            error={errors.gymAddress}
            label="GYM STREET ADDRESS"
            maxLength={500}
            onChangeText={setGymAddress}
            placeholder="One physical location"
            value={gymAddress}
          />
          <AuthTextField
            error={errors.region}
            label="CITY / REGION"
            maxLength={120}
            onChangeText={setRegion}
            placeholder="Nanaimo"
            value={region}
          />
          {submissionError ? (
            <AuthStatusNotice message={submissionError} tone="red" />
          ) : receiptMessage ? (
            <AuthStatusNotice message={receiptMessage} tone="green" />
          ) : null}
          <DataCollectionNotice message="We use the manager contact and gym-location details to review this QR request, verify the location, prevent misuse and contact the applicant. They are not added to a marketing list through this form." />
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
                ? 'REQUEST RECORDED'
                : submitting
                  ? 'RECORDING...'
                  : 'REQUEST GYM QR ->'
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
