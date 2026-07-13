import { validateEnvironment } from './environment';

describe('environment validation', () => {
  it('normalizes safe local defaults', () => {
    const environment = validateEnvironment({
      NODE_ENV: 'test',
      AUTH_MODE: 'test',
    });

    expect(environment.PORT).toBe(3000);
    expect(environment.OPENAPI_ENABLED).toBe(true);
    expect(environment.DATABASE_URL).toContain('localhost:5432');
  });

  it('rejects test authentication in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        AUTH_MODE: 'test',
        FIREBASE_PROJECT_ID: 'gogymgo-production',
      }),
    ).toThrow(/AUTH_MODE must be firebase/i);
  });

  it('requires a Firebase project in production', () => {
    expect(() =>
      validateEnvironment({ NODE_ENV: 'production', AUTH_MODE: 'firebase' }),
    ).toThrow(/FIREBASE_PROJECT_ID is required/i);
  });
});
