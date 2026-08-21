import type { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment';
import { ExpoHttpPushClient, PushProviderError } from './expo-push.client';

const messages = [
  {
    body: 'Open GoGymGo for current facts.',
    data: { notificationId: 'notification-one' },
    title: 'GoGymGo update',
    to: 'ExponentPushToken[device-one]',
  },
  {
    body: 'Open GoGymGo for current facts.',
    data: { notificationId: 'notification-one' },
    title: 'GoGymGo update',
    to: 'ExponentPushToken[device-two]',
  },
] as const;

function config() {
  return {
    get: jest.fn((name: keyof Environment) =>
      name === 'EXPO_PUSH_API_URL'
        ? 'https://push.example.test/send'
        : undefined,
    ),
  } as unknown as ConfigService<Environment, true>;
}

describe('ExpoHttpPushClient', () => {
  it('strictly maps accepted and invalid-token tickets without returning provider text', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: 'ticket-one', status: 'ok' },
            {
              details: { error: 'DeviceNotRegistered' },
              message: 'sensitive provider detail',
              status: 'error',
            },
          ],
        }),
        { headers: { 'content-type': 'application/json' }, status: 200 },
      ),
    );
    const client = new ExpoHttpPushClient(config(), fetcher);

    const result = await client.send(messages);
    expect(result).toEqual([
      { status: 'accepted' },
      { status: 'invalid-token' },
    ]);
    expect(JSON.stringify(result)).not.toContain('sensitive provider detail');
  });

  it.each([
    { data: [{ id: 'only-one', status: 'ok' }] },
    {
      data: [
        { id: 'one', status: 'ok', unexpected: true },
        { id: 'two', status: 'ok' },
      ],
    },
    {
      data: [
        { message: 'missing id', status: 'ok' },
        { id: 'two', status: 'ok' },
      ],
    },
  ])(
    'rejects malformed or count-mismatched provider responses',
    async (body) => {
      const client = new ExpoHttpPushClient(
        config(),
        jest.fn().mockResolvedValue(
          new Response(JSON.stringify(body), {
            headers: { 'content-type': 'application/json' },
            status: 200,
          }),
        ),
      );

      await expect(client.send(messages)).rejects.toBeInstanceOf(
        PushProviderError,
      );
    },
  );

  it('bounds provider batches before any request', async () => {
    const fetcher = jest.fn();
    const client = new ExpoHttpPushClient(config(), fetcher);

    await expect(client.send([])).rejects.toBeInstanceOf(PushProviderError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
