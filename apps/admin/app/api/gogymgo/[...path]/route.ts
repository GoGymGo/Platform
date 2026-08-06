import { NextRequest, NextResponse } from "next/server";
import { buildUpstreamUrl } from "./upstream-url.mjs";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  if (
    path.length === 0 ||
    path.some((segment) => !segment || segment === "." || segment === "..") ||
    path[0] !== "operator"
  ) {
    return NextResponse.json(
      { error: { message: "This administrative route is not available." } },
      { status: 404 },
    );
  }

  const baseUrl = process.env.GOGYMGO_API_URL?.replace(/\/+$/, "");
  if (!baseUrl) {
    return NextResponse.json(
      {
        error: {
          message:
            "The GoGymGo API connection has not been configured for this dashboard.",
        },
      },
      { status: 503 },
    );
  }

  const target = buildUpstreamUrl(baseUrl, path, request.nextUrl.search);
  const authorization = request.headers.get("authorization");
  const idempotencyKey = request.headers.get("idempotency-key");
  const contentType = request.headers.get("content-type");
  const headers = new Headers({ accept: "application/json" });
  if (authorization) headers.set("authorization", authorization);
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
  if (contentType) headers.set("content-type", contentType);

  const response = await fetch(target, {
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.text(),
    cache: "no-store",
    headers,
    method: request.method,
    redirect: "manual",
  });
  const responseType = response.headers.get("content-type") ?? "application/json";
  return new NextResponse(await response.text(), {
    headers: {
      "cache-control": "no-store",
      "content-type": responseType,
    },
    status: response.status,
  });
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
