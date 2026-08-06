import { Redirect, type Href } from 'expo-router';
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
  ScreenLoadingState,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { FirstRunBrandRail, FirstRunScreen } from '@/components/firstRun';
import { ScreenBackButton } from '@/components/onboarding';
import { BrandScreenHeader } from '@/components/screenLayout';
import { colors, fontFamilies, fontSizes, radii, spacing } from '@/constants/theme';
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
    <FirstRunScreen>
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
          <FirstRunBrandRail />
          {onBack ? (
            <ScreenBackButton
              onPress={onBack}
              style={styles.backButtonSpacing}
            />
          ) : null}
          <BrandScreenHeader
            description={description}
            eyebrow={eyebrow}
            style={styles.header}
            title={title}
          />
          {children}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScreenScrollView>
      </KeyboardAvoidingView>
    </FirstRunScreen>
  );
}

export function AuthTextField({
  error,
  label,
  onChangeText,
  secureTextEntry = false,
  value,
  ...inputProps
}: AuthTextFieldProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const { onBlur, onFocus, ...restInputProps } = inputProps;

  return (
    <View style={styles.fieldShell}>
      <TerminalText tone={error ? 'red' : 'dim'} variant="micro">
        {label}
      </TerminalText>
      <View style={[
        styles.inputShell,
        focused ? styles.inputFocused : null,
        error ? styles.inputError : null
      ]}>
        <TextInput
          accessibilityLabel={label}
          allowFontScaling
          maxFontSizeMultiplier={2}
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
          {...restInputProps}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityLabel={`${passwordVisible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            accessibilityRole="button"
            onPress={() => setPasswordVisible((visible) => !visible)}
            style={({ pressed }) => [styles.visibilityButton, pressed ? styles.pressed : null]}
          >
            <TerminalText tone="cyan" variant="micro">
              {passwordVisible ? 'HIDE' : 'SHOW'}
            </TerminalText>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <TerminalText live="assertive" tone="red" uppercase={false} variant="micro">
          {error}
        </TerminalText>
      ) : null}
    </View>
  );
}

export function AuthConfigurationNotice() {
  return (
    <HUDBorderBox style={styles.notice} tone="amber">
      <TerminalText tone="amber" variant="label">
        ACCOUNT SERVICE OFFLINE
      </TerminalText>
      <TerminalText style={styles.noticeBody} tone="muted" uppercase={false} variant="body">
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
    <HUDBorderBox style={styles.notice} tone={tone}>
      <TerminalText
        live={tone === 'red' ? 'assertive' : 'polite'}
        style={styles.noticeBody}
        tone={tone}
        uppercase={false}
        variant="body"
      >
        {message}
      </TerminalText>
    </HUDBorderBox>
  );
}

export function AuthGate({
  allowUnverified = false,
  children,
  signedOutHref = '/sign-in',
  unverifiedHref = '/verify-email'
}: PropsWithChildren<{
  allowUnverified?: boolean;
  signedOutHref?: Href;
  unverifiedHref?: Href;
}>) {
  const { firebaseConfigured, loading, user } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }
  if (!firebaseConfigured || !user) {
    return <Redirect href={signedOutHref} />;
  }
  if (!allowUnverified && !user.emailVerified) {
    return <Redirect href={unverifiedHref} />;
  }

  return children;
}

export function AuthLoadingScreen() {
  return <ScreenLoadingState label="CHECKING ACCOUNT SESSION" />;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.transparent
  },
  sponsorRail: {
    marginBottom: spacing.lg
  },
  backButtonSpacing: {
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.7
  },
  header: {
    marginBottom: spacing.xl
  },
  fieldShell: {
    gap: spacing.xs
  },
  inputShell: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanSoft,
    borderRadius: radii.sm,
    backgroundColor: colors.panel
  },
  inputFocused: {
    borderColor: colors.cyan,
    backgroundColor: colors.surfaceCyanWhisper
  },
  input: {
    minWidth: 0,
    minHeight: 50,
    flex: 1,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontFamily: fontFamilies.ui,
    fontSize: fontSizes.control
  },
  inputError: {
    borderColor: colors.borderPinkHeavy,
    backgroundColor: colors.surfacePinkSoft
  },
  visibilityButton: {
    minWidth: 54,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs
  },
  notice: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.md
  },
  noticeBody: {
    fontFamily: fontFamilies.ui,
    fontSize: 15,
    lineHeight: 23
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
