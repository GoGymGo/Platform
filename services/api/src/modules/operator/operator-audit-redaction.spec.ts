import {
  minimizeOperatorAuditState,
  redactOperatorAuditText,
} from './operator-audit-redaction';

describe('operator audit redaction', () => {
  it('removes sensitive keys recursively while preserving bounded decisions', () => {
    expect(
      minimizeOperatorAuditState({
        decisions: [
          { status: 'approved', token: 'must not appear' },
          { nested: { email: 'private@example.com', version: 3 } },
        ],
        metadata: { privatePayload: 'must not appear' },
        status: 'approved',
        token: 'must not appear',
        version: 4,
      }),
    ).toEqual({
      decisions: [{ status: 'approved' }, { nested: { version: 3 } }],
      status: 'approved',
      version: 4,
    });
  });

  it('redacts secrets, emails, URLs, and tokens from reason text', () => {
    const redacted = redactOperatorAuditText(
      'Email person@example.com token=top-secret https://private.example/path eyJabc.def.ghi',
    );
    expect(redacted).not.toContain('person@example.com');
    expect(redacted).not.toContain('top-secret');
    expect(redacted).not.toContain('private.example');
    expect(redacted).not.toContain('eyJabc');
  });
});
