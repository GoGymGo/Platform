import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  hasExactKeys,
  methodNotAllowed,
  readSameOriginJsonObject,
} from "@/app/api/public-site-request";
import {
  runPublicSiteRetention,
  type RetentionKind,
} from "@/app/api/public-site-storage";
import { readPublicSiteRetentionPolicy } from "@/app/public-site-policy";
import { getD1 } from "@/db";
import {
  isAuthorizedPublicSiteOwner,
  ownerError,
  ownerNoStoreHeaders,
  readPublicSiteOwnerConfig,
  unavailableOwnerRoute,
} from "../public-site-owner";

const retentionKinds = new Set<RetentionKind>(["audit", "events", "feedback"]);

export async function POST(request: Request) {
  const owner = readPublicSiteOwnerConfig(
    process.env,
    "LANDING_D1_RETENTION_ENABLED",
  );
  const retention = readPublicSiteRetentionPolicy(process.env);
  if (!owner || !retention) {
    return unavailableOwnerRoute();
  }

  const user = await getChatGPTUser();
  if (!user) {
    return ownerError("Authentication is required.", 401);
  }
  if (!(await isAuthorizedPublicSiteOwner(user, owner))) {
    return ownerError(
      "Retention operations are restricted to the configured site owner.",
      403,
    );
  }

  const parsed = await readSameOriginJsonObject(request, 256);
  if (
    !parsed.ok ||
    !hasExactKeys(parsed.value, ["kind", "limit"], ["kind", "limit"])
  ) {
    return parsed.ok
      ? ownerError("Use a valid retention kind and limit.", 400)
      : parsed.response;
  }

  const { kind, limit } = parsed.value;
  if (
    typeof kind !== "string" ||
    !retentionKinds.has(kind as RetentionKind) ||
    typeof limit !== "number" ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 500
  ) {
    return ownerError("Use a valid retention kind and limit.", 400);
  }

  try {
    const result = await runPublicSiteRetention(
      getD1(),
      kind as RetentionKind,
      limit,
      new Date(),
      retention,
    );
    return Response.json(
      { deleted: result.deleted, has_more: result.hasMore },
      { headers: ownerNoStoreHeaders, status: 200 },
    );
  } catch {
    return ownerError("Public-site retention is temporarily unavailable.", 503);
  }
}

export function OPTIONS() {
  return methodNotAllowed("POST");
}
