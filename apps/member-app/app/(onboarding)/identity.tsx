import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'

import { AuthTextField } from '@/components/auth'
import { ScreenScrollView, TerminalText } from '@/components/cyber'
import {
  FirstRunPrimaryButton,
  FirstRunScreen,
  FirstRunSecondaryButton
} from '@/components/firstRun'
import { CompactTextButton, OnboardingHeader } from '@/components/onboarding'
import { ProfileAvatar } from '@/components/profileAvatar'
import { getUserFacingErrorMessage } from '@/components/reliability'
import { colors, fontFamilies, spacing, fontSizes } from '@/constants/theme'
import { getPublicInitials, type PublicIdentity } from '@/domain/profile'
import { normalizeScreenName, validateScreenName } from '@/domain/social'
import { useProfileImagePicker } from '@/hooks/useProfileImagePicker'
import { clearScreenMemory, useScreenMemory } from '@/hooks/useScreenMemory'
import { goBackOrReplace } from '@/navigation/goBack'
import { useAuth } from '@/state/auth'
import { useProfile } from '@/state/profile'

export default function IdentityScreen() {
  const { hasPublicIdentity, profileReady, publicIdentity } = useProfile()

  if (!profileReady) {
    return (
      <FirstRunScreen>
        <View style={styles.loading}>
          <TerminalText live="polite" tone="cyan" variant="label">
            LOADING PUBLIC IDENTITY
          </TerminalText>
        </View>
      </FirstRunScreen>
    )
  }

  return (
    <IdentityForm initialIdentity={hasPublicIdentity ? publicIdentity : null} />
  )
}

function IdentityForm({
  initialIdentity
}: {
  initialIdentity: PublicIdentity | null
}) {
  const router = useRouter()
  const { source } = useLocalSearchParams<{ source?: string }>()
  const { user } = useAuth()
  const { setPublicIdentity } = useProfile()
  const draftKey = `identity:${user?.uid ?? 'anonymous'}:${source ?? 'setup'}`
  const initialAlias = initialIdentity?.displayName?.trim() ?? ''
  const [alias, setAlias] = useScreenMemory(
    draftKey,
    initialAlias && !validateScreenName(initialAlias) ? initialAlias : ''
  )
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    chooseProfileImage,
    clearProfileImage,
    isPickingImage,
    isRemovingImage,
    profileImageAvailability,
    profileImageMessage,
    profileImageStatus,
    profileImageUri,
    profileImageVersion,
    retryProfileImage
  } = useProfileImagePicker()
  const normalizedAlias = normalizeScreenName(alias)
  const validationError = alias.length > 0 ? validateScreenName(alias) : null
  const identityIsValid = alias.length > 0 && !validateScreenName(alias)
  const avatarInitials = getPublicInitials(normalizedAlias || 'GG')
  const isEditing = source === 'profile' || source === 'social'
  const returnRoute =
    source === 'social'
      ? '/squad/social'
      : source === 'profile'
        ? '/profile'
        : '/home'

  const handleContinue = async () => {
    const error = validateScreenName(alias)
    setSubmitError(error)
    if (error) return

    setSaving(true)
    try {
      await setPublicIdentity({
        callsign: initialIdentity?.callsign ?? '',
        displayName: normalizedAlias,
        mode: 'alias'
      })
    } catch (mutationError) {
      setSubmitError(
        getUserFacingErrorMessage(
          mutationError,
          'Your Alias could not be saved. Check your connection and try again.'
        )
      )
      setSaving(false)
      return
    }

    setSaving(false)
    clearScreenMemory(draftKey)
    router.replace(returnRoute)
  }

  return (
    <FirstRunScreen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScreenScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          memoryKey={draftKey}
          showsVerticalScrollIndicator={false}
        >
          <OnboardingHeader
            label={isEditing ? 'EDIT ALIAS' : 'OPTIONAL PROFILE'}
            onBack={() => goBackOrReplace(router, returnRoute)}
            progress={100}
            step="PROFILE"
          />

          <TerminalText style={styles.title} tone="text" variant="title">
            HOW SHOULD OTHERS SEE YOU?
          </TerminalText>
          <TerminalText
            style={styles.body}
            tone="muted"
            uppercase={false}
            variant="body"
          >
            Your private player ID works immediately. Add a custom Alias only if
            you want one shown on rankings and Weekly Challenges.
          </TerminalText>

          <AuthTextField
            autoCapitalize="characters"
            autoCorrect={false}
            error={submitError ?? validationError ?? undefined}
            label="ALIAS"
            maxLength={24}
            onChangeText={(value) => {
              setAlias(value)
              setSubmitError(null)
            }}
            placeholder="YOUR_ALIAS"
            value={alias}
          />

          <View style={styles.pictureSection}>
            <ProfileAvatar
              imageUri={profileImageUri}
              initials={avatarInitials}
              size={72}
              version={profileImageVersion}
            />
            <View style={styles.pictureCopy}>
              <TerminalText tone="text" variant="label">
                PROFILE PICTURE // OPTIONAL
              </TerminalText>
              <TerminalText
                style={styles.pictureHelper}
                tone="muted"
                uppercase={false}
                variant="body"
              >
                {profileImageAvailability === 'configured'
                  ? 'Approved pictures appear here. New pictures stay private and pending until moderation.'
                  : profileImageAvailability === 'loading'
                    ? 'Checking whether private picture uploads are available...'
                    : 'Picture uploads are not available. Your initials avatar remains active.'}
              </TerminalText>
            </View>
            <FirstRunSecondaryButton
              disabled={
                isPickingImage ||
                isRemovingImage ||
                profileImageAvailability !== 'configured'
              }
              label={
                isPickingImage
                  ? 'PREPARING PICTURE...'
                  : profileImageUri
                    ? 'CHANGE PICTURE'
                    : 'ADD PICTURE'
              }
              onPress={chooseProfileImage}
              style={styles.pictureButton}
            />
            {profileImageUri || profileImageStatus ? (
              <CompactTextButton
                disabled={isPickingImage || isRemovingImage}
                label={isRemovingImage ? 'REMOVING...' : 'REMOVE PICTURE'}
                onPress={clearProfileImage}
                tone="muted"
              />
            ) : null}
            {profileImageAvailability === 'unavailable' ? (
              <CompactTextButton
                label="RETRY PICTURE SERVICE"
                onPress={retryProfileImage}
                tone="muted"
              />
            ) : null}
            {profileImageStatus === 'pending_review' ? (
              <TerminalText live="polite" tone="amber" variant="caption">
                PICTURE PENDING MODERATION. INITIALS OR THE PREVIOUS APPROVED
                PICTURE REMAIN ACTIVE.
              </TerminalText>
            ) : profileImageStatus === 'rejected' ? (
              <TerminalText live="polite" tone="red" variant="caption">
                PICTURE WAS NOT APPROVED. CHOOSE A DIFFERENT IMAGE OR KEEP YOUR
                CURRENT AVATAR.
              </TerminalText>
            ) : null}
            {profileImageMessage ? (
              <TerminalText
                style={styles.pictureMessage}
                tone="muted"
                variant="caption"
              >
                {profileImageMessage}
              </TerminalText>
            ) : null}
          </View>

          <FirstRunPrimaryButton
            disabled={!identityIsValid || saving}
            label={saving ? 'SAVING ALIAS...' : 'SAVE ALIAS ->'}
            onPress={handleContinue}
            style={styles.primaryButton}
          />
        </ScreenScrollView>
      </KeyboardAvoidingView>
    </FirstRunScreen>
  )
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.transparent
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    lineHeight: 34,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: colors.cyan
  },
  body: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingLeft: 16,
    fontFamily: fontFamilies.ui,
    fontSize: 16,
    lineHeight: 24
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
    fontFamily: fontFamilies.ui,
    textAlign: 'center'
  },
  pictureButton: {
    width: '100%',
    minHeight: 46
  },
  pictureMessage: {
    fontFamily: fontFamilies.ui,
    textAlign: 'center'
  },
  primaryButton: {
    marginTop: spacing.lg
  }
})
