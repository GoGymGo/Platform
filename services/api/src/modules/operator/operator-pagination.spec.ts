import { BadRequestException } from '@nestjs/common';
import {
  compareOperatorQueueTuple,
  decodeOperatorAuditCursor,
  decodeOperatorQueueCursor,
  encodeOperatorAuditCursor,
  encodeOperatorQueueCursor,
} from './operator-pagination';

describe('operator pagination cursors', () => {
  const createdAt = new Date('2026-08-20T12:00:00.000Z');

  it('round trips the complete stable queue ordering tuple', () => {
    const cursor = { createdAt, id: 'item-1', kind: 'profile_media' as const };
    expect(
      decodeOperatorQueueCursor(encodeOperatorQueueCursor(cursor)),
    ).toEqual(cursor);
  });

  it('orders equal-time queue rows by kind and then id without a tie', () => {
    const rows = [
      {
        createdAt: createdAt.toISOString(),
        id: 'b',
        kind: 'profile_media' as const,
      },
      {
        createdAt: createdAt.toISOString(),
        id: 'z',
        kind: 'partner_application' as const,
      },
      {
        createdAt: createdAt.toISOString(),
        id: 'a',
        kind: 'profile_media' as const,
      },
    ];

    expect(rows.sort(compareOperatorQueueTuple)).toEqual([
      {
        createdAt: createdAt.toISOString(),
        id: 'z',
        kind: 'partner_application',
      },
      { createdAt: createdAt.toISOString(), id: 'a', kind: 'profile_media' },
      { createdAt: createdAt.toISOString(), id: 'b', kind: 'profile_media' },
    ]);
  });

  it('round trips the complete stable audit ordering tuple', () => {
    const cursor = { createdAt, id: 'audit-1' };
    expect(
      decodeOperatorAuditCursor(encodeOperatorAuditCursor(cursor)),
    ).toEqual(cursor);
  });

  it.each([
    'not-base64',
    Buffer.from('{}').toString('base64url'),
    Buffer.from(
      JSON.stringify({
        createdAt: createdAt.toISOString(),
        id: 'item-1',
        kind: 'unsupported',
      }),
    ).toString('base64url'),
  ])('fails closed for an invalid queue cursor', (value) => {
    expect(() => decodeOperatorQueueCursor(value)).toThrow(BadRequestException);
  });
});
