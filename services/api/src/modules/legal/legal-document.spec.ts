import {
  buildJurisdictionHierarchy,
  hashLegalDocumentContent,
  hashLegalReceiptBundle,
  legalAcceptanceContextAt,
  normalizeLegalLocale,
  requireLegalPublicationApproval,
} from './legal-document';

describe('legal document identity', () => {
  it('resolves exact, country, then global jurisdiction scope', () => {
    expect(buildJurisdictionHierarchy('ca-bc')).toEqual([
      'CA-BC',
      'CA',
      'GLOBAL',
    ]);
    expect(buildJurisdictionHierarchy('US')).toEqual(['US', 'GLOBAL']);
    expect(buildJurisdictionHierarchy('global')).toEqual(['GLOBAL']);
  });

  it('normalizes supported locale forms without silently falling back', () => {
    expect(normalizeLegalLocale('en-ca')).toBe('en-CA');
    expect(normalizeLegalLocale('fr')).toBe('fr');
    expect(() => normalizeLegalLocale('english')).toThrow(/locale/i);
  });

  it('hashes canonical content and bundle order deterministically', () => {
    const firstContent = hashLegalDocumentContent('Terms', {
      intro: 'Read this',
      sections: [{ body: 'One', heading: 'A' }],
    });
    const reorderedContent = hashLegalDocumentContent('Terms', {
      sections: [{ heading: 'A', body: 'One' }],
      intro: 'Read this',
    });
    expect(firstContent).toBe(reorderedContent);

    const documents = [
      {
        contentSha256: 'a'.repeat(64),
        documentKey: 'terms_of_service',
        id: '10000000-0000-4000-8000-000000000001',
        receiptRequirement: 'accept',
        version: 'v1',
      },
      {
        contentSha256: 'b'.repeat(64),
        documentKey: 'privacy_policy',
        id: '10000000-0000-4000-8000-000000000002',
        receiptRequirement: 'acknowledge',
        version: 'v1',
      },
    ];
    expect(
      hashLegalReceiptBundle({
        documents,
        jurisdictionCode: 'CA-BC',
        locale: 'en-CA',
      }),
    ).toBe(
      hashLegalReceiptBundle({
        documents: [...documents].reverse(),
        jurisdictionCode: 'ca-bc',
        locale: 'en-ca',
      }),
    );
  });

  it('separates a reset acceptance context from the initial account context', () => {
    expect(legalAcceptanceContextAt(null).toISOString()).toBe(
      '1970-01-01T00:00:00.000Z',
    );
    const resetAt = new Date('2026-08-13T12:00:00.000Z');
    expect(legalAcceptanceContextAt(resetAt)).toBe(resetAt);
  });

  it('requires approval for the canonical exact publication configuration', () => {
    const configuration = {
      documents: [{ documentKey: 'terms_of_service', version: 'v1' }],
    };
    let expectedSha256 = '';
    try {
      requireLegalPublicationApproval(configuration, undefined);
    } catch (error) {
      expectedSha256 =
        (error as Error).message.match(/[0-9a-f]{64}/)?.[0] ?? '';
    }
    expect(expectedSha256).toHaveLength(64);
    expect(requireLegalPublicationApproval(configuration, expectedSha256)).toBe(
      expectedSha256,
    );
    expect(() =>
      requireLegalPublicationApproval(
        { documents: [{ documentKey: 'terms_of_service', version: 'v2' }] },
        expectedSha256,
      ),
    ).toThrow(/owner and counsel approval/i);
  });
});
