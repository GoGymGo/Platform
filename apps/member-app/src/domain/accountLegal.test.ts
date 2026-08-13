import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { legalReceiptMatchesCurrentBundle, requiredLegalDocuments } from '@/domain/accountLegal';
import type { CurrentLegalDocuments, LegalReceiptStatus } from '@/domain/accountReadiness';

const currentBundle: CurrentLegalDocuments = {
  bundleSha256: 'a'.repeat(64),
  configured: true,
  documents: [
    {
      content: { intro: 'Terms', sections: [{ heading: 'Terms' }] },
      contentSha256: 'b'.repeat(64),
      documentKey: 'terms_of_service',
      effectiveAt: '2026-08-11T07:00:00.000Z',
      id: '10000000-0000-4000-8000-000000000001',
      jurisdictionCode: 'GLOBAL',
      locale: 'en',
      receiptRequirement: 'accept',
      title: 'Terms',
      version: 'v1'
    },
    {
      content: { intro: 'Notice', sections: [{ heading: 'Notice' }] },
      contentSha256: 'c'.repeat(64),
      documentKey: 'regional_notice',
      effectiveAt: '2026-08-11T07:00:00.000Z',
      id: '10000000-0000-4000-8000-000000000002',
      jurisdictionCode: 'CA-BC',
      locale: 'en',
      receiptRequirement: 'acknowledge',
      title: 'Regional notice',
      version: 'v2'
    },
    {
      content: { intro: 'Rules', sections: [{ heading: 'Rules' }] },
      contentSha256: 'd'.repeat(64),
      documentKey: 'official_contest_rules',
      effectiveAt: '2026-08-11T07:00:00.000Z',
      id: '10000000-0000-4000-8000-000000000003',
      jurisdictionCode: 'GLOBAL',
      locale: 'en',
      receiptRequirement: 'none',
      title: 'Rules',
      version: 'v1'
    }
  ],
  jurisdictionCode: 'CA-BC',
  locale: 'en'
};

const currentReceipt: LegalReceiptStatus = {
  ...currentBundle,
  acceptedAt: '2026-08-12T07:00:00.000Z',
  complete: true,
  receiptBundleId: '20000000-0000-4000-8000-000000000001'
};

describe('account legal bundle state', () => {
  it('lists every exact receipt-required document and action', () => {
    assert.deepEqual(
      requiredLegalDocuments(currentBundle).map((document) => [
        document.documentKey,
        document.receiptRequirement,
        document.version
      ]),
      [
        ['terms_of_service', 'accept', 'v1'],
        ['regional_notice', 'acknowledge', 'v2']
      ]
    );
  });

  it('accepts only a complete receipt for the displayed exact bundle', () => {
    assert.equal(legalReceiptMatchesCurrentBundle(currentReceipt, currentBundle), true);
    assert.equal(
      legalReceiptMatchesCurrentBundle(
        { ...currentReceipt, bundleSha256: 'f'.repeat(64) },
        currentBundle
      ),
      false
    );
    assert.equal(
      legalReceiptMatchesCurrentBundle(
        { ...currentReceipt, jurisdictionCode: 'US-WA' },
        currentBundle
      ),
      false
    );
    assert.equal(
      legalReceiptMatchesCurrentBundle(
        { ...currentReceipt, complete: false, receiptBundleId: null },
        currentBundle
      ),
      false
    );
  });
});
