import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View
} from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  CyberButtonPrimary,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { CompactTextButton, OnboardingHeader } from '@/components/onboarding';
import { ProfileAvatar } from '@/components/profileAvatar';
import { SponsorRail as SponsorBanner } from '@/components/sponsor';
import { colors, fontFamilies, radii, spacing, fontSizes } from '@/constants/theme';
import { getPublicInitials, type PublicIdentity } from '@/domain/profile';
import { useProfileImagePicker } from '@/hooks/useProfileImagePicker';
import { goBackOrReplace } from '@/navigation/goBack';
import { useProfile } from '@/state/profile';

export default function IdentityScreen() {
  const { hasPublicIdentity, profileReady, publicIdentity } = useProfile();

  if (!profileReady) {
    return (
      <ScreenContainer>
        <View style={styles.loading}>
          <TerminalText glow tone="cyan" variant="label">
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
  const [alias, setAlias] = useState(
    initialIdentity?.displayName || initialIdentity?.callsign || ''
  );
  const {
    chooseProfileImage,
    clearProfileImage,
    isPickingImage,
    profileImageMessage,
    profileImageUri
  } = useProfileImagePicker();
  const identityIsValid = alias.trim().length >= 2;
  const avatarInitials = getPublicInitials(alias.trim() || 'GG');

  const handleContinue = async () => {
    const normalizedAlias = alias.trim();

    await setPublicIdentity({
      callsign: normalizedAlias,
      displayName: normalizedAlias,
      mode: 'alias'
    });

    if (source === 'profile') {
      router.replace('/profile');
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
        <SponsorBanner compact />
        <ScreenScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <OnboardingHeader
            label={source === 'profile' ? 'EDIT ALIAS' : 'PUBLIC IDENTITY'}
            onBack={() => goBackOrReplace(
              router,
              source === 'profile' ? '/profile' : '/'
            )}
            progress={source === 'profile' ? 100 : 20}
            step={source === 'profile' ? 'PROFILE' : 'STEP 01 / 05'}
          />

          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            HOW SHOULD OTHERS SEE YOU?
          </TerminalText>
          <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
            This is shown on leaderboards, Period Matches and community features.
            Personal details always stay private.
          </TerminalText>

          <View style={styles.fieldGroup}>
            <TerminalText tone="dim" variant="micro">
              ALIAS
            </TerminalText>
            <TextInput
              accessibilityLabel="Alias"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={24}
              onChangeText={setAlias}
              placeholder="Enter your alias"
              placeholderTextColor={colors.dim}
              selectionColor={colors.cyan}
              style={styles.input}
              value={alias}
            />
          </View>

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
            disabled={!identityIsValid}
            label={source === 'profile' ? 'SAVE ALIAS ->' : 'CONTINUE ->'}
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
  fieldGroup: {
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  input: {
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderCyanMedium,
    borderRadius: radii.sm,
    color: colors.text,
    backgroundColor: colors.panelAlpha70,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.control
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
