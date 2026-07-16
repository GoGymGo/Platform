import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View
} from 'react-native';

import { AuthTextField } from '@/components/auth';
import {
  ScreenScrollView,
  CyberButtonOutline,
  CyberButtonPrimary,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { CompactTextButton, OnboardingHeader } from '@/components/onboarding';
import { ProfileAvatar } from '@/components/profileAvatar';
import { colors, fontFamilies, spacing, fontSizes } from '@/constants/theme';
import { useUpdateScreenName } from '@/data/socialHooks';
import { getPublicInitials, type PublicIdentity } from '@/domain/profile';
import { normalizeScreenName, validateScreenName } from '@/domain/social';
import { useProfileImagePicker } from '@/hooks/useProfileImagePicker';
import { goBackOrReplace } from '@/navigation/goBack';
import { useProfile } from '@/state/profile';

export default function IdentityScreen() {
  const { hasPublicIdentity, profileReady, publicIdentity } = useProfile();

  if (!profileReady) {
    return (
      <ScreenContainer>
        <View style={styles.loading}>
          <TerminalText glow live="polite" tone="cyan" variant="label">
            LOADING PUBLIC IDENTITY
          </TerminalText>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <IdentityForm initialIdentity={hasPublicIdentity ? publicIdentity : null} />
  );
}

function IdentityForm({ initialIdentity }: { initialIdentity: PublicIdentity | null }) {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const { setPublicIdentity } = useProfile();
  const updateAlias = useUpdateScreenName();
  const [alias, setAlias] = useState(
    initialIdentity?.displayName || initialIdentity?.callsign || ''
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    chooseProfileImage,
    clearProfileImage,
    isPickingImage,
    profileImageMessage,
    profileImageUri
  } = useProfileImagePicker();
  const normalizedAlias = normalizeScreenName(alias);
  const validationError = alias.length > 0 ? validateScreenName(alias) : null;
  const identityIsValid = alias.length > 0 && !validateScreenName(alias);
  const avatarInitials = getPublicInitials(normalizedAlias || 'GG');
  const isEditing = source === 'profile' || source === 'social';
  const returnRoute = source === 'social' ? '/squad/social' : '/profile';

  const handleContinue = async () => {
    const error = validateScreenName(alias);
    setSubmitError(error);
    if (error) return;

    try {
      const profile = await updateAlias.mutateAsync(normalizedAlias);
      await setPublicIdentity({
        callsign: profile.screenName,
        displayName: profile.screenName,
        mode: 'alias'
      });
    } catch (mutationError) {
      setSubmitError(
        mutationError instanceof Error
          ? mutationError.message.replace(/screen name/gi, 'alias')
          : 'Your alias could not be saved. Try again.'
      );
      return;
    }

    if (isEditing) {
      router.replace(returnRoute);
      return;
    }

    router.push('/region');
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScreenScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <OnboardingHeader
            label={isEditing ? 'EDIT ALIAS' : 'PUBLIC IDENTITY'}
            onBack={() => goBackOrReplace(
              router,
              isEditing ? returnRoute : '/'
            )}
            progress={isEditing ? 100 : 20}
            step={isEditing ? 'PROFILE' : 'STEP 01 / 05'}
          />

          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            HOW SHOULD OTHERS SEE YOU?
          </TerminalText>
          <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
            This is shown on leaderboards, Weekly Challenges and community features.
            Personal details always stay private.
          </TerminalText>

          <AuthTextField
            autoCapitalize="characters"
            autoCorrect={false}
            error={submitError ?? validationError ?? undefined}
            label="ALIAS"
            maxLength={24}
            onChangeText={(value) => {
              setAlias(value);
              setSubmitError(null);
            }}
            placeholder="GHOST_RUNNER"
            value={alias}
          />

          <View style={styles.pictureSection}>
            <ProfileAvatar
              imageUri={profileImageUri}
              initials={avatarInitials}
              size={72}
            />
            <View style={styles.pictureCopy}>
              <TerminalText tone="text" variant="label">
                PROFILE PICTURE // OPTIONAL
              </TerminalText>
              <TerminalText style={styles.pictureHelper} tone="muted" uppercase={false} variant="body">
                Add a picture or keep your initials avatar.
              </TerminalText>
            </View>
            <CyberButtonOutline
              disabled={isPickingImage}
              label={isPickingImage
                ? 'PREPARING PICTURE...'
                : profileImageUri
                  ? 'CHANGE PICTURE'
                  : 'ADD PICTURE'}
              onPress={chooseProfileImage}
              style={styles.pictureButton}
            />
            {profileImageUri ? (
              <CompactTextButton
                label="REMOVE PICTURE"
                onPress={clearProfileImage}
                tone="muted"
              />
            ) : null}
            {profileImageMessage ? (
              <TerminalText style={styles.pictureMessage} tone="muted" variant="caption">
                {profileImageMessage}
              </TerminalText>
            ) : null}
          </View>

          <CyberButtonPrimary
            disabled={!identityIsValid || updateAlias.isPending}
            label={updateAlias.isPending
              ? 'SAVING ALIAS...'
              : isEditing
                ? 'SAVE ALIAS ->'
                : 'CONTINUE ->'}
            onPress={handleContinue}
            style={styles.primaryButton}
          />
        </ScreenScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    lineHeight: 34,
    textAlign: 'center'
  },
  body: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  pictureSection: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md
  },
  pictureCopy: {
    alignItems: 'center',
    gap: 2
  },
  pictureHelper: {
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  pictureButton: {
    width: '100%',
    minHeight: 46
  },
  pictureMessage: {
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  primaryButton: {
    marginTop: spacing.lg
  }
});
