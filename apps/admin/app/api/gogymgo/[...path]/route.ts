import { NextRequest, NextResponse } from "next/server";
import {
  buildUpstreamUrl,
  isAllowedAdminProxyPath,
  validatedAdminProxySearch,
} from "./upstream-url.mjs";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const maximumBodyBytes = 1_048_576;

class ProxyRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function proxyError(message: string, status: number) {
  return NextResponse.json(
    { error: { message } },
    { headers: { "cache-control": "no-store" }, status },
  );
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  if (!isAllowedAdminProxyPath(path)) {
    return proxyError("This administrative route is not available.", 404);
  }

  const baseUrl = process.env.GOGYMGO_API_URL?.trim();
  if (!baseUrl) {
    return proxyError(
      "The GoGymGo API connection is unavailable for this dashboard.",
      503,
    );
  }

  const authorization = request.headers.get("authorization");
  if (!authorization || !/^Bearer [^\s,]{20,4096}$/i.test(authorization)) {
    return proxyError("A valid operator session is required.", 401);
  }
  const idempotencyKey = request.headers.get("idempotency-key");
  if (
    idempotencyKey &&
    (!/^[\x20-\x7E]+$/.test(idempotencyKey) || idempotencyKey.length > 200)
  ) {
    return proxyError("The idempotency key is invalid.", 400);
  }

  try {
    validatedAdminProxySearch(request.nextUrl.search);
  } catch {
    return proxyError("The administrative query is invalid.", 400);
  }

  let target: URL;
  try {
    target = buildUpstreamUrl(baseUrl, path, request.nextUrl.search);
  } catch {
    return proxyError("The GoGymGo API connection is unavailable.", 503);
  }

  let body: string | undefined;
  try {
    body = await readBoundedJsonBody(request);
  } catch (error) {
    if (error instanceof ProxyRequestError) {
      return proxyError(error.message, error.status);
    }
    return proxyError("The administrative request body is invalid.", 400);
  }

  const headers = new Headers({ accept: "application/json" });
  headers.set("authorization", authorization);
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
  if (body !== undefined) headers.set("content-type", "application/json");

  let response: Response;
  try {
    response = await fetch(target, {
      body,
      cache: "no-store",
      headers,
      method: request.method,
      redirect: "manual",
    });
  } catch {
    return proxyError(
      "The GoGymGo API could not be reached. Try again shortly.",
      502,
    );
  }
  if (response.status >= 300 && response.status < 400) {
    return proxyError("The GoGymGo API returned an invalid redirect.", 502);
  }
  const responseType = response.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(responseType)) {
    return proxyError("The GoGymGo API returned an invalid response.", 502);
  }
  return new NextResponse(await response.text(), {
    headers: {
      "cache-control": "no-store",
      "content-type": responseType,
    },
    status: response.status,
  });
}

async function readBoundedJsonBody(
  request: NextRequest,
): Promise<string | undefined> {
  if (request.method === "GET" || request.method === "HEAD" || !request.body) {
    return undefined;
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0];
  if (contentType?.trim().toLowerCase() !== "application/json") {
    throw new ProxyRequestError(
      "Administrative request bodies must use application/json.",
      415,
    );
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBodyBytes) {
    throw new ProxyRequestError(
      "The administrative request body is too large.",
      413,
    );
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let value = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    byteLength += chunk.value.byteLength;
    if (byteLength > maximumBodyBytes) {
      await reader.cancel();
      throw new ProxyRequestError(
        "The administrative request body is too large.",
        413,
      );
    }
    value += decoder.decode(chunk.value, { stream: true });
  }
  value += decoder.decode();
  try {
    JSON.parse(value);
  } catch {
    throw new ProxyRequestError(
      "The administrative request body must contain valid JSON.",
      400,
    );
  }
  return value;
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
