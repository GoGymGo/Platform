import {
  buildJurisdictionHierarchy,
  hashLegalDocumentContent,
  hashLegalReceiptBundle,
  normalizeLegalLocale,
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
});
