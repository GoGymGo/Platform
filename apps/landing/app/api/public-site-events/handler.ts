import {
  publicSiteEventDefinitions,
  type PublicSiteEventName,
} from "@/app/public-site-events";
import type { PublicSiteStoreOutcome } from "@/app/api/public-site-storage";
import {
  hasExactKeys,
  methodNotAllowed,
  publicJsonError,
  publicNoStoreHeaders,
  readSameOriginJsonObject,
} from "@/app/api/public-site-request";

const maximumEventBodyBytes = 256;

export type PublicSiteEventHandlerDependencies = {
  store(eventName: PublicSiteEventName): Promise<PublicSiteStoreOutcome>;
};

export async function handlePublicSiteEvent(
  request: Request,
  dependencies: PublicSiteEventHandlerDependencies,
): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowed("POST");
  }

  const parsed = await readSameOriginJsonObject(request, maximumEventBodyBytes);
  if (!parsed.ok) {
    return parsed.response;
  }
  if (!hasExactKeys(parsed.value, ["eventName"], ["eventName"])) {
    return publicJsonError("Invalid event.", 400);
  }

  const eventName = parsed.value.eventName;
  if (
    typeof eventName !== "string" ||
    !Object.hasOwn(publicSiteEventDefinitions, eventName)
  ) {
    return publicJsonError("Unknown event.", 400);
  }

  try {
    const outcome = await dependencies.store(eventName as PublicSiteEventName);
    if (outcome === "rate_limited") {
      return publicJsonError(
        "Public-site measurement is receiving too many requests.",
        429,
        { "Retry-After": "60" },
      );
    }

    return new Response(null, {
      headers: publicNoStoreHeaders,
      status: 204,
    });
  } catch {
    return publicJsonError(
      "Public-site measurement is temporarily unavailable.",
      503,
    );
  }
}
