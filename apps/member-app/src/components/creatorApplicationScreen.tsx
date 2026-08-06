import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthStatusNotice, AuthTextField } from '@/components/auth';
import {
  ScreenScrollView,
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import {
  creatorFeaturePausedMessage,
  creatorFeatureStatusLabel,
  creatorFeaturesEnabled
} from '@/config/features';
import { CompactTextButton, OnboardingHeader } from '@/components/onboarding';
import { DataCollectionNotice } from '@/components/legal';
import { BrandScreenHeader, brandScreenStyles } from '@/components/screenLayout';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import {
  hasCreatorApplicationErrors,
  normalizeCreatorApplication,
  validateCreatorApplication,
  type CreatorApplicationErrors
} from '@/domain/creatorApplication';
import { submitCreatorApplication } from '@/services/creatorApplication';
import { useCompetitionRegion } from '@/state/competitionRegion';
import { dismissCreatorInvite, recordCreatorApplication } from '@/state/onboardingPreferences';
import { goBackOrReplace } from '@/navigation/goBack';
import { useAuth } from '@/state/auth';
import { useApi } from '@/state/api';

const requirements = [
  '20-45 MINUTE FOLLOW-ALONG WORKOUT',
  'CLEAR COACHING, EQUIPMENT AND REGION',
  'SAFE MOVEMENT, CLEAN AUDIO AND CONTENT RIGHTS',
  'SPONSOR + SYNTHETIC MEDIA DISCLOSURE',
  'VIDEO EDITING, BRAND PLACEMENT + AI ADAPTATION RIGHTS'
] as const;

export default function CreatorApplicationScreen() {
  const router = useRouter();
  const { api } = useApi();
  const { user } = useAuth();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const { competitionRegion } = useCompetitionRegion();
  const [channelUrl, setChannelUrl] = useState('');
  const [errors, setErrors] = useState<CreatorApplicationErrors>({});
  const [region, setRegion] = useState(competitionRegion.label);
  const [sampleWorkoutUrl, setSampleWorkoutUrl] = useState('');
  const [showRequirements, setShowRequirements] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionError, setSubmissionError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [workoutStyle, setWorkoutStyle] = useState('');
  const openedAfterFirstWorkout = source === 'first-workout';

  if (!creatorFeaturesEnabled) {
    return (
      <ScreenContainer>
        <ScreenScrollView
          bounces={false}
          contentContainerStyle={brandScreenStyles.content}
          showsVerticalScrollIndicator={false}
        >
          <OnboardingHeader
            label="OPTIONAL"
            onBack={() =>
              openedAfterFirstWorkout
                ? router.replace('/home')
                : goBackOrReplace(router, source === 'profile' ? '/profile' : '/join')
            }
            progress={38}
            step="CREATOR APPLICATION"
          />
          <BrandScreenHeader
            eyebrow="CREATOR APPLICATION"
            title="APPLY AS A CREATOR"
          />
          <HUDBorderBox style={styles.form} tone="amber">
            <TerminalText tone="amber" variant="label">
              {creatorFeatureStatusLabel}
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
              {creatorFeaturePausedMessage}
            </TerminalText>
            <CyberButtonOutline
              label={openedAfterFirstWorkout ? 'RETURN HOME' : 'BACK TO JOIN OPTIONS'}
              onPress={() =>
                openedAfterFirstWorkout
                  ? router.replace('/home')
                  : goBackOrReplace(router, source === 'profile' ? '/profile' : '/join')
              }
            />
          </HUDBorderBox>
        </ScreenScrollView>
      </ScreenContainer>
    );
  }

  async function submitApplication() {
    const input = normalizeCreatorApplication({
      channelUrl,
      region,
      sampleWorkoutUrl,
      workoutStyle
    });
    const nextErrors = validateCreatorApplication(input);
    setErrors(nextErrors);

    if (hasCreatorApplicationErrors(nextErrors)) {
      return;
    }

    setSubmitting(true);
    setSubmissionError(undefined);
    try {
      if (!user) {
        throw new Error('A signed-in account is required to submit a creator application.');
      }

      await submitCreatorApplication(api, user.uid, input);
      await recordCreatorApplication(user.uid);
      setSubmitted(true);
    } catch {
      setSubmissionError(
        'CREATOR APPLICATION COULD NOT BE SENT. CHECK YOUR CONNECTION AND TRY AGAIN.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function dismissPrompt() {
    if (user) {
      await dismissCreatorInvite(user.uid);
    }
    router.replace('/home');
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
          label="OPTIONAL"
          onBack={() =>
            openedAfterFirstWorkout
              ? router.replace('/home')
              : goBackOrReplace(router, source === 'profile' ? '/profile' : '/join')
          }
          progress={38}
          step="CREATOR APPLICATION"
        />

        <BrandScreenHeader
          description="Share your region, creator profile and one sample workout. Approved creators receive the complete publishing and content-rights process."
          eyebrow="CREATOR APPLICATION"
          title="APPLY AS A CREATOR"
        />

        <CompactTextButton
          label={showRequirements ? 'HIDE CREATOR REQUIREMENTS' : 'VIEW CREATOR REQUIREMENTS'}
          onPress={() => setShowRequirements((current) => !current)}
          tone={showRequirements ? 'muted' : 'cyan'}
        />
        {showRequirements ? (
          <View style={styles.requirements}>
            {requirements.map((requirement, index) => (
              <View key={requirement} style={styles.requirementRow}>
                <TerminalText tone="cyan" variant="micro">
                  {String(index + 1).padStart(2, '0')}
                </TerminalText>
                <TerminalText style={styles.requirementText} tone="text" variant="body">
                  {requirement}
                </TerminalText>
              </View>
            ))}
          </View>
        ) : null}

        <HUDBorderBox style={styles.form} tone="muted">
          <AuthTextField
            error={errors.region}
            label="YOUR REGION"
            onChangeText={setRegion}
            placeholder="Nanaimo"
            value={region}
          />
          <AuthTextField
            autoCapitalize="none"
            error={errors.channelUrl}
            keyboardType="url"
            label="CREATOR CHANNEL OR PROFILE URL"
            onChangeText={setChannelUrl}
            placeholder="https://youtube.com/@yourchannel"
            value={channelUrl}
          />
          <AuthTextField
            error={errors.workoutStyle}
            label="WORKOUT STYLE"
            onChangeText={setWorkoutStyle}
            placeholder="Strength, HIIT, mobility..."
            value={workoutStyle}
          />
          <AuthTextField
            autoCapitalize="none"
            error={errors.sampleWorkoutUrl}
            keyboardType="url"
            label="SAMPLE WORKOUT URL"
            onChangeText={setSampleWorkoutUrl}
            placeholder="https://youtube.com/watch?v=..."
            value={sampleWorkoutUrl}
          />
          {submissionError ? (
            <AuthStatusNotice message={submissionError} tone="red" />
          ) : submitted ? (
            <AuthStatusNotice
              message="APPLICATION SUBMITTED. GOGYMGO WILL REVIEW YOUR REGION, SAMPLE WORKOUT AND CONTENT RIGHTS BEFORE CONTACTING YOU."
              tone="green"
            />
          ) : null}
          <DataCollectionNotice message="We use the region, profile and sample-workout links to review this creator request, prevent misuse and contact the signed-in applicant about the review. They are not used to award competition credit." />
          <CyberButtonPrimary
            disabled={submitting || submitted}
            label={
              submitted
                ? 'APPLICATION SUBMITTED'
                : submitting
                  ? 'SUBMITTING...'
                  : 'APPLY AS A CREATOR ->'
            }
            onPress={submitApplication}
            tone="cyan"
          />
        </HUDBorderBox>

        <View style={styles.actions}>
          {submitted ? (
            <CyberButtonOutline
              label="OPEN CREATOR CATALOG"
              onPress={() => router.replace('/workouts')}
            />
          ) : null}
          {openedAfterFirstWorkout && !submitted ? (
            <CyberButtonPrimary label="DON'T SHOW THIS AGAIN" onPress={dismissPrompt} />
          ) : null}
        </View>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  requirements: {
    borderTopWidth: 1,
    borderColor: colors.borderMuted
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.borderMuted
  },
  requirementText: {
    flex: 1,
    fontFamily: fontFamilies.body
  },
  form: {
    gap: spacing.md,
    padding: spacing.lg
  },
  actions: {
    gap: spacing.sm
  }
});
