const canonicalPublicOrigin = "https://gogymgo.com";

export const publicNoStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

type JsonObjectResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; response: Response };

export async function readSameOriginJsonObject(
  request: Request,
  maximumBytes: number,
): Promise<JsonObjectResult> {
  const originError = validateSameOriginRequest(request);
  if (originError) {
    return { ok: false, response: originError };
  }

  if (!isJsonContentType(request.headers.get("content-type"))) {
    return {
      ok: false,
      response: publicJsonError(
        "Send this request as UTF-8 JSON.",
        415,
      ),
    };
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    if (!/^[0-9]+$/.test(contentLength)) {
      return {
        ok: false,
        response: publicJsonError("Invalid request length.", 400),
      };
    }
    if (Number(contentLength) > maximumBytes) {
      return {
        ok: false,
        response: publicJsonError("This request is too large.", 413),
      };
    }
  }

  let bytes: Uint8Array | null;
  try {
    bytes = await readBoundedBody(request, maximumBytes);
  } catch {
    return {
      ok: false,
      response: publicJsonError("The request body could not be read.", 400),
    };
  }
  if (!bytes) {
    return {
      ok: false,
      response: publicJsonError("This request is too large.", 413),
    };
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const value: unknown = JSON.parse(text);
    if (!isJsonObject(value)) {
      throw new TypeError("JSON body is not an object");
    }
    return { ok: true, value };
  } catch {
    return {
      ok: false,
      response: publicJsonError("Enter valid JSON details.", 400),
    };
  }
}

export function hasExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): boolean {
  const keys = Object.keys(value);
  const allowed = new Set(allowedKeys);
  return (
    keys.every((key) => allowed.has(key)) &&
    requiredKeys.every((key) => Object.hasOwn(value, key))
  );
}

export function publicJsonError(
  error: string,
  status: number,
  extraHeaders?: HeadersInit,
): Response {
  return Response.json(
    { error },
    {
      headers: { ...publicNoStoreHeaders, ...extraHeaders },
      status,
    },
  );
}

export function methodNotAllowed(allow: string): Response {
  return publicJsonError("Method not allowed.", 405, { Allow: allow });
}

function validateSameOriginRequest(request: Request): Response | null {
  let requestOrigin: string;
  try {
    const url = new URL(request.url);
    requestOrigin = url.origin;
    const isLoopback =
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      (url.protocol === "http:" || url.protocol === "https:");
    if (requestOrigin !== canonicalPublicOrigin && !isLoopback) {
      return publicJsonError("This request origin is not allowed.", 403);
    }
  } catch {
    return publicJsonError("This request origin is not allowed.", 403);
  }

  const origin = request.headers.get("origin");
  if (!origin || origin !== requestOrigin) {
    return publicJsonError("This request origin is not allowed.", 403);
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    return publicJsonError("This request origin is not allowed.", 403);
  }

  return null;
}

function isJsonContentType(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const parts = value.split(";").map((part) => part.trim().toLowerCase());
  if (parts[0] !== "application/json" || parts.length > 2) {
    return false;
  }
  return parts.length === 1 || parts[1] === "charset=utf-8";
}

async function readBoundedBody(
  request: Request,
  maximumBytes: number,
): Promise<Uint8Array | null> {
  if (!request.body) {
    return new Uint8Array();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    byteLength += value.byteLength;
    if (byteLength > maximumBytes) {
      try {
        await reader.cancel();
      } catch {
        // The bounded rejection is unchanged if the sender already disconnected.
      }
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
