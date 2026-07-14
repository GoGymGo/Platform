import { basicCredentialsMatch } from './hyperwallet-webhook.guard';

describe('Hyperwallet webhook Basic authentication', () => {
  const valid = `Basic ${Buffer.from('webhook-user:webhook-secret').toString('base64')}`;

  it('accepts exact credentials', () => {
    expect(basicCredentialsMatch(valid, 'webhook-user', 'webhook-secret')).toBe(
      true,
    );
  });

  it.each([
    undefined,
    'Bearer token',
    'Basic not-base64',
    `Basic ${Buffer.from('webhook-user:wrong').toString('base64')}`,
  ])('rejects malformed or incorrect credentials', (authorization) => {
    expect(
      basicCredentialsMatch(authorization, 'webhook-user', 'webhook-secret'),
    ).toBe(false);
  });
});
