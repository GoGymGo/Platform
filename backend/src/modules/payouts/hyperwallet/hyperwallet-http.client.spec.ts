import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../config/environment';
import { HyperwalletHttpClient } from './hyperwallet-http.client';

function createConfig(): ConfigService<Environment, true> {
  return new ConfigService<Environment, true>({
    HYPERWALLET_API_URL: 'https://hyperwallet.test/rest/v4',
    HYPERWALLET_PASSWORD: 'secret',
    HYPERWALLET_PORTAL_URL: 'https://portal.hyperwallet.test',
    HYPERWALLET_PROGRAM_TOKEN: 'prg-test',
    HYPERWALLET_USERNAME: 'api-user',
  } as Environment);
}

describe('HyperwalletHttpClient', () => {
  it('creates a minimal hosted-onboarding user without sensitive identity data', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'PRE_ACTIVATED', token: 'usr-1' }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        },
      ),
    );
    const client = new HyperwalletHttpClient(createConfig(), fetcher);

    await expect(
      client.createUser({
        clientUserId: 'internal-user-id',
        country: 'CA',
        email: 'winner@example.com',
      }),
    ).resolves.toEqual({ status: 'PRE_ACTIVATED', token: 'usr-1' });

    const request = fetcher.mock.calls[0] as [string, RequestInit];
    expect(typeof request[1].body).toBe('string');
    const body = JSON.parse(request[1].body as string) as Record<
      string,
      unknown
    >;
    expect(request[0]).toBe('https://hyperwallet.test/rest/v4/users');
    expect(body).toEqual({
      clientUserId: 'internal-user-id',
      country: 'CA',
      email: 'winner@example.com',
      profileType: 'INDIVIDUAL',
      programToken: 'prg-test',
    });
    expect(body).not.toHaveProperty('bankAccount');
    expect(body).not.toHaveProperty('taxId');
  });

  it('creates payments using exact decimal strings', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'SCHEDULED', token: 'pmt-1' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 201,
      }),
    );
    const client = new HyperwalletHttpClient(createConfig(), fetcher);

    await client.createPayment({
      amountMinor: 10_005,
      clientPaymentId: 'claim-id',
      currency: 'CAD',
      destinationToken: 'usr-1',
    });

    const request = fetcher.mock.calls[0] as [string, RequestInit];
    expect(typeof request[1].body).toBe('string');
    expect(JSON.parse(request[1].body as string)).toMatchObject({
      amount: '100.05',
      clientPaymentId: 'claim-id',
      currency: 'CAD',
      destinationToken: 'usr-1',
    });
  });

  it('does not expose provider response content through public failures', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'bank account rejected: 1234' }), {
        status: 422,
      }),
    );
    const client = new HyperwalletHttpClient(createConfig(), fetcher);

    await expect(client.findUserByClientUserId('user')).rejects.toThrow(
      /provider rejected the request/i,
    );
  });
});
