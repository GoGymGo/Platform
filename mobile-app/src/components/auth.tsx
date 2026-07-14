import { Redirect } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps
} from 'react-native';
import { useState, type PropsWithChildren, type ReactNode } from 'react';

import {
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { SponsorRail } from '@/components/sponsor';
import {
  borders,
  colors,
  componentSizes,
  fontFamilies,
  fontSizes,
  interactionStates,
  radii,
  spacing
} from '@/constants/theme';
import { useAuth } from '@/state/auth';

type AuthScreenShellProps = PropsWithChildren<{
  description: string;
  eyebrow: string;
  footer?: ReactNode;
  onBack?: () => void;
  title: string;
}>;

type AuthTextFieldProps = Omit<TextInputProps, 'onChangeText' | 'style' | 'value'> & {
  error?: string;
  label: string;
  onChangeText: (value: string) => void;
  value: string;
};

export function AuthScreenShell({
  children,
  description,
  eyebrow,
  footer,
  onBack,
  title
}: AuthScreenShellProps) {
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
          <SponsorRail compact style={styles.sponsorRail} />
          {onBack ? (
            <Pressable
              accessibilityLabel="Back"
              accessibilityRole="button"
              onPress={onBack}
              style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
            >
              <TerminalText glow tone="cyan" variant="button">
                {'<'}
              </TerminalText>
            </Pressable>
          ) : null}
          <View style={styles.header}>
            <TerminalText glow tone="cyan" variant="label">
              {eyebrow}
            </TerminalText>
            <TerminalText glow style={styles.title} tone="cyan" variant="title">
              {title}
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
              {description}
            </TerminalText>
          </View>
          {children}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScreenScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export function AuthTextField({
  accessibilityHint,
  editable = true,
  error,
  label,
  onBlur,
  onChangeText,
  onFocus,
  secureTextEntry = false,
  value,
  ...inputProps
}: AuthTextFieldProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldShell}>
      <TerminalText tone={error ? 'red' : 'dim'} variant="micro">
        {label}
      </TerminalText>
      <View
        style={[
          styles.inputShell,
          focused ? styles.inputFocused : null,
          error ? styles.inputError : null,
          !editable ? styles.inputDisabled : null
        ]}
      >
        <TextInput
          accessibilityHint={error ?? accessibilityHint}
          accessibilityLabel={label}
          accessibilityState={{ disabled: !editable }}
          editable={editable}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onChangeText={onChangeText}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={colors.dim}
          secureTextEntry={secureTextEntry && !passwordVisible}
          selectionColor={colors.cyan}
          style={styles.input}
          value={value}
          {...inputProps}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityLabel={`${passwordVisible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            accessibilityRole="button"
            onPress={() => setPasswordVisible((visible) => !visible)}
            style={({ pressed }) => [styles.visibilityButton, pressed ? styles.pressed : null]}
          >
            <TerminalText glow tone="cyan" variant="micro">
              {passwordVisible ? 'HIDE' : 'SHOW'}
            </TerminalText>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <TerminalText tone="red" uppercase={false} variant="micro">
          {error}
        </TerminalText>
      ) : null}
    </View>
  );
}

export function AuthConfigurationNotice() {
  return (
    <HUDBorderBox style={styles.notice} tone="amber">
      <TerminalText glow tone="amber" variant="label">
        ACCOUNT SERVICE OFFLINE
      </TerminalText>
      <TerminalText tone="muted" uppercase={false} variant="body">
        Account creation and sign-in are temporarily unavailable while the secure
        account service is being connected.
      </TerminalText>
    </HUDBorderBox>
  );
}

export function AuthStatusNotice({
  message,
  tone = 'cyan'
}: {
  message: string;
  tone?: 'cyan' | 'pink' | 'green' | 'amber' | 'red';
}) {
  return (
    <HUDBorderBox
      accessibilityLabel={message}
      accessibilityLiveRegion={tone === 'red' ? 'assertive' : 'polite'}
      accessibilityRole={tone === 'red' ? 'alert' : 'text'}
      style={styles.notice}
      tone={tone}
    >
      <TerminalText tone={tone} uppercase={false} variant="body">
        {message}
      </TerminalText>
    </HUDBorderBox>
  );
}

export function AuthGate({
  allowUnverified = false,
  children
}: PropsWithChildren<{ allowUnverified?: boolean }>) {
  const { firebaseConfigured, loading, user } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }
  if (!firebaseConfigured || !user) {
    return <Redirect href="/sign-in" />;
  }
  if (!allowUnverified && !user.emailVerified) {
    return <Redirect href="/verify-email" />;
  }

  return children;
}

export function AuthLoadingScreen() {
  return (
    <ScreenContainer>
      <View accessibilityLiveRegion="polite" style={styles.loading}>
        <TerminalText glow tone="cyan" variant="label">
          CHECKING ACCOUNT SESSION
        </TerminalText>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  sponsorRail: {
    marginBottom: spacing.lg
  },
  backButton: {
    width: componentSizes.minimumTouchTarget,
    height: componentSizes.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: borders.hairline,
    borderColor: colors.borderInteractive,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceInteractive,
    ...interactionStates.webFocus
  },
  pressed: {
    ...interactionStates.pressed
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xl
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle
  },
  fieldShell: {
    gap: spacing.xs
  },
  inputShell: {
    minHeight: componentSizes.inputHeight,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: borders.hairline,
    borderColor: colors.borderInteractive,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceInteractive
  },
  input: {
    minWidth: 0,
    minHeight: componentSizes.inputHeight - borders.focus,
    flex: 1,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.control,
    outlineWidth: 0
  },
  inputError: {
    borderColor: colors.borderError,
    backgroundColor: colors.surfaceError
  },
  inputFocused: {
    borderColor: colors.borderFocus,
    backgroundColor: colors.surfaceRaised
  },
  inputDisabled: {
    borderColor: colors.borderMutedDisabled,
    backgroundColor: colors.surfaceDisabled,
    ...interactionStates.disabled
  },
  visibilityButton: {
    minWidth: 54,
    minHeight: componentSizes.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs
  },
  notice: {
    gap: spacing.sm,
    padding: spacing.lg
  },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing.xl
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl
  }
});
