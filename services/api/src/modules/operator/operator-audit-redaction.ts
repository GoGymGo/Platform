import type { JsonObject, JsonValue } from '../../database/database.types';

const sensitiveAuditKey =
  /(?:actor|winner|subject)?user_?id|email|firebase|authorization|bearer|password|secret|token|credential|qr_?payload|(?:coupon|reward|redemption)_?code|code_?fingerprint|encrypted|claim_?url|fulfillment_?instructions|seed_?reveal|object_?(?:key|url)|private|payload|content|metadata|coordinates?|latitude|longitude|address|notes?|message/i;

export function minimizeOperatorAuditState(value: unknown): JsonObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !sensitiveAuditKey.test(key))
      .slice(0, 16)
      .map(([key, entry]) => [key, minimizeAuditValue(entry)]),
  );
}

export function redactOperatorAuditText(value: string): string {
  return value
    .slice(0, 500)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      '[redacted-token]',
    )
    .replace(
      /\b(?:authorization|bearer|password|secret|token|credential|coupon(?:\s+code)?)\s*[:=]\s*\S+/gi,
      '[redacted-sensitive-value]',
    );
}

function minimizeAuditValue(value: unknown): JsonValue {
  if (value === null) return null;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string')
    return redactOperatorAuditText(value).slice(0, 256);
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(minimizeAuditValue);
  }
  return minimizeOperatorAuditState(value);
}
