import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WithdrawLegalDocumentDto } from './legal.dto';

describe('WithdrawLegalDocumentDto', () => {
  it('requires a positive lifecycle version and bounded audit reason', async () => {
    await expect(
      validate(
        plainToInstance(WithdrawLegalDocumentDto, {
          expectedVersion: 2,
          reason: 'Counsel withdrew this version before Contest publication.',
        }),
      ),
    ).resolves.toHaveLength(0);

    for (const input of [
      { reason: 'Counsel withdrew this version before Contest publication.' },
      {
        expectedVersion: 0,
        reason: 'Counsel withdrew this version before Contest publication.',
      },
      { expectedVersion: 2, reason: 'short' },
      { expectedVersion: 2, reason: 'x'.repeat(501) },
    ]) {
      await expect(
        validate(plainToInstance(WithdrawLegalDocumentDto, input)),
      ).resolves.not.toHaveLength(0);
    }
  });
});
