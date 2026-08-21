const exportPageSignature = "gogymgo.landing-interest-export-page";
const exportSchemaVersion = 1;
const defaultPageLimit = 50;
const maximumPageLimit = 100;

export type LandingInterestExportConfig = {
  cutoffExclusive: string;
  exportId: string;
};

type InterestExportCursor = {
  createdAt: string;
  cutoffExclusive: string;
  exportId: string;
  id: string;
  kind: "interest";
  sequence: number;
};

export type LandingInterestExportPage = {
  artifact_signature: typeof exportPageSignature;
  content_sha256: string;
  cutoff_exclusive: string;
  export_id: string;
  next_cursor: string | null;
  page_count: number;
  page_limit: number;
  page_sequence: number;
  request_cursor: string | null;
  results: Array<LandingInterestExportRow & { source_record_sha256: string }>;
  schema_version: typeof exportSchemaVersion;
  source_count: number;
};

export type LandingInterestExportRow = {
  audience: "brand" | "gym_goer";
  company_name: string | null;
  consent: boolean;
  created_at: string;
  discovery_source: string | null;
  email: string;
  full_name: string;
  goal_days: number | null;
  id: string;
  message: string | null;
  partnership_interest: string | null;
  region: string;
  updated_at: string;
  website: string | null;
  workout_style: string | null;
};

type PageRequest = {
  cursor: InterestExportCursor | null;
  encodedCursor: string | null;
  limit: number;
  sequence: number;
};

export function readLandingInterestExportConfig(
  values: Record<string, string | undefined>,
): LandingInterestExportConfig | null {
  const exportId = values.LANDING_D1_EXPORT_ID?.trim();
  const cutoffExclusive = values.LANDING_D1_EXPORT_CUTOFF_EXCLUSIVE?.trim();
  if (
    !exportId ||
    !isUuid(exportId) ||
    !cutoffExclusive ||
    !isIsoTimestamp(cutoffExclusive)
  ) {
    return null;
  }
  return { cutoffExclusive, exportId: exportId.toLowerCase() };
}

export function readLandingInterestExportPageRequest(
  request: Request,
  config: LandingInterestExportConfig,
): PageRequest | null {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }

  for (const key of url.searchParams.keys()) {
    if (key !== "cursor" && key !== "limit") {
      return null;
    }
    if (url.searchParams.getAll(key).length !== 1) {
      return null;
    }
  }

  const rawLimit = url.searchParams.get("limit");
  if (
    rawLimit !== null &&
    !/^(?:[1-9]|[1-9][0-9]|100)$/.test(rawLimit)
  ) {
    return null;
  }
  const limit = rawLimit === null ? defaultPageLimit : Number(rawLimit);
  if (limit < 1 || limit > maximumPageLimit) {
    return null;
  }

  const encodedCursor = url.searchParams.get("cursor");
  if (encodedCursor === null) {
    return { cursor: null, encodedCursor: null, limit, sequence: 1 };
  }
  if (encodedCursor.length < 1 || encodedCursor.length > 1_024) {
    return null;
  }
  const cursor = decodeCursor(encodedCursor);
  if (
    !cursor ||
    cursor.exportId !== config.exportId ||
    cursor.cutoffExclusive !== config.cutoffExclusive
  ) {
    return null;
  }
  return {
    cursor,
    encodedCursor,
    limit,
    sequence: cursor.sequence,
  };
}

export async function exportLandingInterestPage(
  db: D1Database,
  config: LandingInterestExportConfig,
  page: PageRequest,
): Promise<LandingInterestExportPage> {
  const dataStatement = page.cursor
    ? db
        .prepare(
          `SELECT id, audience, email, full_name, company_name, website,
                  region, goal_days, workout_style, partnership_interest,
                  discovery_source, message, consent, created_at, updated_at
           FROM interest_submissions
           WHERE created_at < ?1
             AND (created_at > ?2 OR (created_at = ?2 AND id > ?3))
           ORDER BY created_at ASC, id ASC
           LIMIT ?4`,
        )
        .bind(
          config.cutoffExclusive,
          page.cursor.createdAt,
          page.cursor.id,
          page.limit + 1,
        )
    : db
        .prepare(
          `SELECT id, audience, email, full_name, company_name, website,
                  region, goal_days, workout_style, partnership_interest,
                  discovery_source, message, consent, created_at, updated_at
           FROM interest_submissions
           WHERE created_at < ?1
           ORDER BY created_at ASC, id ASC
           LIMIT ?2`,
        )
        .bind(config.cutoffExclusive, page.limit + 1);
  const countStatement = db
    .prepare(
      `SELECT COUNT(*) AS source_count
       FROM interest_submissions
       WHERE created_at < ?1`,
    )
    .bind(config.cutoffExclusive);

  const [data, count] = await db.batch<Record<string, unknown>>([
    dataStatement,
    countStatement,
  ]);
  const decoded = data.results.map(decodeExportRow);
  const hasMore = decoded.length > page.limit;
  const selected = decoded.slice(0, page.limit);
  const last = selected.at(-1);
  const sourceCount = decodeSourceCount(count.results);
  const results = await Promise.all(
    selected.map(async (row) => ({
      ...row,
      source_record_sha256: await sha256(stableJson(row)),
    })),
  );
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          createdAt: last.created_at,
          cutoffExclusive: config.cutoffExclusive,
          exportId: config.exportId,
          id: last.id,
          kind: "interest",
          sequence: page.sequence + 1,
        })
      : null;
  const unsigned = {
    artifact_signature: exportPageSignature,
    cutoff_exclusive: config.cutoffExclusive,
    export_id: config.exportId,
    next_cursor: nextCursor,
    page_count: results.length,
    page_limit: page.limit,
    page_sequence: page.sequence,
    request_cursor: page.encodedCursor,
    results,
    schema_version: exportSchemaVersion,
    source_count: sourceCount,
  } as const;

  return {
    ...unsigned,
    content_sha256: await sha256(stableJson(unsigned)),
  };
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(",")}}`;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function decodeExportRow(row: Record<string, unknown>): LandingInterestExportRow {
  const exactKeys = [
    "audience",
    "company_name",
    "consent",
    "created_at",
    "discovery_source",
    "email",
    "full_name",
    "goal_days",
    "id",
    "message",
    "partnership_interest",
    "region",
    "updated_at",
    "website",
    "workout_style",
  ] as const;
  if (
    !hasExactKeys(row, exactKeys) ||
    (row.audience !== "brand" && row.audience !== "gym_goer") ||
    typeof row.email !== "string" ||
    row.email.length < 3 ||
    row.email.length > 320 ||
    typeof row.full_name !== "string" ||
    row.full_name.length < 2 ||
    row.full_name.length > 100 ||
    typeof row.region !== "string" ||
    row.region.length < 2 ||
    row.region.length > 160 ||
    typeof row.id !== "string" ||
    row.id.length < 1 ||
    row.id.length > 64 ||
    !isOptionalString(row.company_name, 140) ||
    !isOptionalString(row.website, 300) ||
    !isOptionalString(row.workout_style, 60) ||
    !isOptionalString(row.partnership_interest, 80) ||
    !isOptionalString(row.discovery_source, 80) ||
    !isOptionalString(row.message, 1_200) ||
    (row.goal_days !== null &&
      (typeof row.goal_days !== "number" ||
        !Number.isInteger(row.goal_days) ||
        row.goal_days < 1 ||
        row.goal_days > 7)) ||
    (row.consent !== 0 && row.consent !== 1 && typeof row.consent !== "boolean") ||
    typeof row.created_at !== "string" ||
    !isIsoTimestamp(row.created_at) ||
    typeof row.updated_at !== "string" ||
    !isIsoTimestamp(row.updated_at)
  ) {
    throw new Error("Invalid historical interest export row");
  }

  return {
    audience: row.audience,
    company_name: row.company_name,
    consent: row.consent === 1 || row.consent === true,
    created_at: row.created_at,
    discovery_source: row.discovery_source,
    email: row.email.trim().toLowerCase(),
    full_name: row.full_name.trim(),
    goal_days: row.goal_days,
    id: row.id,
    message: row.message,
    partnership_interest: row.partnership_interest,
    region: row.region.trim(),
    updated_at: row.updated_at,
    website: row.website,
    workout_style: row.workout_style,
  };
}

function decodeSourceCount(rows: Array<Record<string, unknown>>): number {
  const row = rows[0];
  if (
    rows.length !== 1 ||
    !row ||
    !hasExactKeys(row, ["source_count"]) ||
    typeof row.source_count !== "number" ||
    !Number.isSafeInteger(row.source_count) ||
    row.source_count < 0
  ) {
    throw new Error("Invalid historical interest export count");
  }
  return row.source_count;
}

function encodeCursor(cursor: InterestExportCursor): string {
  return btoa(JSON.stringify(cursor))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeCursor(value: string): InterestExportCursor | null {
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded: unknown = JSON.parse(atob(padded));
    if (
      !decoded ||
      typeof decoded !== "object" ||
      Array.isArray(decoded) ||
      !hasExactKeys(decoded as Record<string, unknown>, [
        "createdAt",
        "cutoffExclusive",
        "exportId",
        "id",
        "kind",
        "sequence",
      ])
    ) {
      return null;
    }
    const cursor = decoded as Record<string, unknown>;
    if (
      cursor.kind !== "interest" ||
      typeof cursor.createdAt !== "string" ||
      !isIsoTimestamp(cursor.createdAt) ||
      typeof cursor.cutoffExclusive !== "string" ||
      !isIsoTimestamp(cursor.cutoffExclusive) ||
      typeof cursor.exportId !== "string" ||
      !isUuid(cursor.exportId) ||
      typeof cursor.id !== "string" ||
      cursor.id.length < 1 ||
      cursor.id.length > 64 ||
      typeof cursor.sequence !== "number" ||
      !Number.isSafeInteger(cursor.sequence) ||
      cursor.sequence < 2 ||
      cursor.sequence > 1_000_000
    ) {
      return null;
    }
    return cursor as unknown as InterestExportCursor;
  } catch {
    return null;
  }
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function isOptionalString(value: unknown, maximumLength: number): value is string | null {
  return value === null || (typeof value === "string" && value.length <= maximumLength);
}

function isIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
