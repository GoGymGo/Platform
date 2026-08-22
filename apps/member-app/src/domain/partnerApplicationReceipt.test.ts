import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decodePartnerApplicationReceipt,
  partnerApplicationReceiptMessage,
} from "./partnerApplicationReceipt";

const receipt = {
  applicationType: "sponsor",
  id: "10000000-0000-4000-8000-000000000001",
  outcome: "created",
  retentionExpiresAt: "2027-08-21T00:00:00.000Z",
  status: "submitted",
  submittedAt: "2026-08-21T00:00:00.000Z",
} as const;

describe("partner application receipts", () => {
  it("decodes the exact authoritative receipt", () => {
    assert.deepEqual(
      decodePartnerApplicationReceipt(receipt, "sponsor"),
      receipt,
    );
    assert.match(partnerApplicationReceiptMessage(receipt), /NOT APPROVAL/);
  });

  it("rejects a mismatched type, malformed timestamp and over-returned payload", () => {
    assert.throws(() => decodePartnerApplicationReceipt(receipt, "gym"));
    assert.throws(() =>
      decodePartnerApplicationReceipt(
        { ...receipt, submittedAt: "today" },
        "sponsor",
      ),
    );
    assert.throws(() =>
      decodePartnerApplicationReceipt(
        { ...receipt, payload: { private: true } },
        "sponsor",
      ),
    );
  });
});
