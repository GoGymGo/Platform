import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getAuthErrorMessage,
  hasAuthFormErrors,
  normalizeEmail,
  validateSignInForm,
  validateSignUpForm
} from './auth';

describe('authentication form rules', () => {
  it('normalizes email addresses before Firebase receives them', () => {
    assert.equal(normalizeEmail('  Athlete@Example.COM '), 'athlete@example.com');
  });

  it('rejects incomplete and mismatched signup details', () => {
    const errors = validateSignUpForm('not-an-email', 'short', 'different');

    assert.equal(hasAuthFormErrors(errors), true);
    assert.equal(errors.email, 'ENTER A VALID EMAIL ADDRESS.');
    assert.equal(errors.password, 'USE AT LEAST 8 CHARACTERS.');
    assert.equal(errors.confirmPassword, 'PASSWORDS DO NOT MATCH.');
  });

  it('accepts a valid signup form', () => {
    assert.deepEqual(
      validateSignUpForm('athlete@example.com', 'training123', 'training123'),
      {}
    );
  });

  it('requires both sign-in fields', () => {
    assert.deepEqual(validateSignInForm('', ''), {
      email: 'EMAIL IS REQUIRED.',
      password: 'PASSWORD IS REQUIRED.'
    });
  });

  it('maps Firebase errors to stable user-facing copy', () => {
    assert.equal(
      getAuthErrorMessage({ code: 'auth/invalid-credential' }),
      'EMAIL OR PASSWORD IS INCORRECT.'
    );
  });
});
