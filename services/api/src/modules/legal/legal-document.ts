import { createHash } from 'node:crypto';
import { stableJson } from '../../common/idempotency/stable-json';
import type { JsonObject } from '../../database/database.types';

export const requiredAccountLegalDocumentKeys = [
  'privacy_policy',
  'terms_of_service',
] as const;

const jurisdictionPattern = /^(?:GLOBAL|[A-Z]{2}(?:-[A-Z0-9]{1,8})?)$/;
const localePattern = /^[a-z]{2}(?:-[A-Z]{2})?$/;
const initialLegalAcceptanceContext = new Date(0);

export function legalAcceptanceContextAt(onboardingResetAt: Date | null): Date {
  return onboardingResetAt ?? initialLegalAcceptanceContext;
}

export function normalizeJurisdictionCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!jurisdictionPattern.test(normalized)) {
    throw new Error('Invalid legal jurisdiction code.');
  }
  return normalized;
}

export function normalizeLegalLocale(value: string): string {
  const [language, region, ...extra] = value.trim().split('-');
  const normalized = region
    ? `${language.toLowerCase()}-${region.toUpperCase()}`
    : language.toLowerCase();
  if (extra.length > 0 || !localePattern.test(normalized)) {
    throw new Error('Invalid legal document locale.');
  }
  return normalized;
}

export function buildJurisdictionHierarchy(value: string): string[] {
  const normalized = normalizeJurisdictionCode(value);
  if (normalized === 'GLOBAL') {
    return ['GLOBAL'];
  }
  const [country, subdivision] = normalized.split('-');
  return subdivision ? [normalized, country, 'GLOBAL'] : [country, 'GLOBAL'];
}

export function hashLegalDocumentContent(
  title: string,
  content: JsonObject,
): string {
  return createHash('sha256')
    .update(stableJson({ content, title: title.trim() }))
    .digest('hex');
}

export function requireLegalPublicationApproval(
  configuration: JsonObject,
  suppliedApprovalSha256: string | undefined,
): string {
  const approvalSha256 = createHash('sha256')
    .update(stableJson(configuration))
    .digest('hex');
  if (suppliedApprovalSha256?.trim().toLowerCase() !== approvalSha256) {
    throw new Error(
      'CONFIRM_PUBLIC_LEGAL_APPROVAL_SHA256 must equal the exact public legal ' +
        `configuration SHA-256 ${approvalSha256} after owner and counsel approval.`,
    );
  }
  return approvalSha256;
}

export function hashLegalReceiptBundle(input: {
  documents: readonly {
    contentSha256: string;
    documentKey: string;
    id: string;
    receiptRequirement: string;
    version: string;
  }[];
  jurisdictionCode: string;
  locale: string;
}): string {
  const documents = [...input.documents]
    .sort((left, right) => left.documentKey.localeCompare(right.documentKey))
    .map((document) => ({
      contentSha256: document.contentSha256,
      documentKey: document.documentKey,
      id: document.id,
      receiptRequirement: document.receiptRequirement,
      version: document.version,
    }));
  return createHash('sha256')
    .update(
      stableJson({
        documents,
        jurisdictionCode: normalizeJurisdictionCode(input.jurisdictionCode),
        locale: normalizeLegalLocale(input.locale),
      }),
    )
    .digest('hex');
}
