export type AuthFormErrors = {
  confirmPassword?: string;
  email?: string;
  password?: string;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return 'EMAIL IS REQUIRED.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return 'ENTER A VALID EMAIL ADDRESS.';
  }

  return undefined;
}

export function validatePassword(password: string) {
  if (!password) {
    return 'PASSWORD IS REQUIRED.';
  }

  if (password.length < 8) {
    return 'USE AT LEAST 8 CHARACTERS.';
  }

  return undefined;
}

export function validateSignInForm(email: string, password: string): AuthFormErrors {
  return compactErrors({
    email: validateEmail(email),
    password: password ? undefined : 'PASSWORD IS REQUIRED.'
  });
}

export function validateSignUpForm(
  email: string,
  password: string,
  confirmPassword: string
): AuthFormErrors {
  return compactErrors({
    confirmPassword:
      password && password !== confirmPassword ? 'PASSWORDS DO NOT MATCH.' : undefined,
    email: validateEmail(email),
    password: validatePassword(password)
  });
}

export function hasAuthFormErrors(errors: AuthFormErrors) {
  return Object.values(errors).some(Boolean);
}

export function getAuthErrorMessage(error: unknown) {
  const code = getErrorCode(error);

  const messages: Readonly<Record<string, string>> = {
    'auth/account-exists-with-different-credential':
      'THIS EMAIL USES A DIFFERENT SIGN-IN METHOD.',
    'auth/email-already-in-use': 'AN ACCOUNT ALREADY EXISTS FOR THIS EMAIL.',
    'auth/invalid-credential': 'EMAIL OR PASSWORD IS INCORRECT.',
    'auth/invalid-email': 'ENTER A VALID EMAIL ADDRESS.',
    'auth/network-request-failed': 'NETWORK CONNECTION FAILED. TRY AGAIN.',
    'auth/operation-not-allowed': 'THIS SIGN-IN METHOD IS NOT ENABLED YET.',
    'auth/popup-blocked': 'THE SIGN-IN WINDOW WAS BLOCKED. ALLOW POPUPS AND TRY AGAIN.',
    'auth/popup-closed-by-user': 'SIGN-IN WAS CANCELED.',
    'auth/too-many-requests': 'TOO MANY ATTEMPTS. WAIT A MOMENT AND TRY AGAIN.',
    'auth/id-token-revoked': 'YOUR SESSION EXPIRED. SIGN IN AGAIN.',
    'auth/invalid-user-token': 'YOUR SESSION EXPIRED. SIGN IN AGAIN.',
    'auth/user-disabled': 'THIS ACCOUNT HAS BEEN DISABLED.',
    'auth/user-not-found': 'EMAIL OR PASSWORD IS INCORRECT.',
    'auth/user-token-expired': 'YOUR SESSION EXPIRED. SIGN IN AGAIN.',
    'auth/weak-password': 'CHOOSE A STRONGER PASSWORD.',
    ERR_REQUEST_CANCELED: 'SIGN-IN WAS CANCELED.',
    SIGN_IN_CANCELLED: 'SIGN-IN WAS CANCELED.'
  };

  if (code && messages[code]) {
    return messages[code];
  }

  if (error instanceof Error && /missing|configure|configuration/i.test(error.message)) {
    return 'AUTHENTICATION SETUP IS NOT COMPLETE.';
  }

  return 'AUTHENTICATION COULD NOT BE COMPLETED. TRY AGAIN.';
}

export function shouldClearAuthSession(error: unknown) {
  return [
    'auth/id-token-revoked',
    'auth/invalid-user-token',
    'auth/user-disabled',
    'auth/user-not-found',
    'auth/user-token-expired'
  ].includes(getErrorCode(error) ?? '');
}

function compactErrors(errors: AuthFormErrors): AuthFormErrors {
  return Object.fromEntries(
    Object.entries(errors).filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }

  return typeof error.code === 'string' ? error.code : undefined;
}
