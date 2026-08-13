import type {
  AccountLegalDocument,
  CurrentLegalDocuments,
  LegalReceiptStatus
} from '@/domain/accountReadiness';

export function requiredLegalDocuments(
  bundle: CurrentLegalDocuments | undefined
): readonly AccountLegalDocument[] {
  return (bundle?.documents ?? []).filter((document) => document.receiptRequirement !== 'none');
}

export function legalReceiptMatchesCurrentBundle(
  receipt: LegalReceiptStatus | undefined,
  bundle: CurrentLegalDocuments | undefined
): boolean {
  return Boolean(
    receipt?.complete &&
    receipt.receiptBundleId &&
    bundle?.configured &&
    receipt.bundleSha256 === bundle.bundleSha256 &&
    receipt.jurisdictionCode === bundle.jurisdictionCode &&
    receipt.locale === bundle.locale
  );
}
