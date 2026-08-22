export type PartnerApplicationType = "creator" | "gym" | "sponsor";

export type PartnerApplicationReceipt = {
  applicationType: PartnerApplicationType;
  id: string;
  outcome: "created" | "duplicate" | "screened";
  retentionExpiresAt: string | null;
  status: "approved" | "in_review" | "rejected" | "submitted";
  submittedAt: string;
};

const receiptKeys = [
  "applicationType",
  "id",
  "outcome",
  "retentionExpiresAt",
  "status",
  "submittedAt",
] as const;

export function decodePartnerApplicationReceipt(
  value: unknown,
  expectedType: PartnerApplicationType,
): PartnerApplicationReceipt {
  if (!isRecord(value) || !hasExactKeys(value, receiptKeys)) {
    throw new Error("The partner application receipt was not valid.");
  }

  if (
    value.applicationType !== expectedType ||
    !isUuid(value.id) ||
    !isOneOf(value.outcome, ["created", "duplicate", "screened"]) ||
    !isOneOf(value.status, [
      "approved",
      "in_review",
      "rejected",
      "submitted",
    ]) ||
    !isIsoDateTime(value.submittedAt) ||
    !(
      value.retentionExpiresAt === null ||
      isIsoDateTime(value.retentionExpiresAt)
    )
  ) {
    throw new Error("The partner application receipt was not valid.");
  }

  return value as PartnerApplicationReceipt;
}

export function partnerApplicationReceiptMessage(
  receipt: PartnerApplicationReceipt,
) {
  if (receipt.outcome === "duplicate") {
    return "A MATCHING REQUEST WAS ALREADY RECORDED. THIS RECEIPT IS NOT APPROVAL, ACTIVATION OR A CONTRACT.";
  }

  return "REQUEST RECORDED FOR POSSIBLE REVIEW. THIS RECEIPT IS NOT APPROVAL, ACTIVATION OR A CONTRACT.";
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isIsoDateTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}
