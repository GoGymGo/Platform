import { handlePublicSiteEvent } from "./handler";
import { methodNotAllowed } from "@/app/api/public-site-request";
import { storePublicSiteEvent } from "@/app/api/public-site-storage";
import { readPublicSiteRetentionPolicy } from "@/app/public-site-policy";
import { getD1 } from "@/db";

export async function POST(request: Request) {
  return handlePublicSiteEvent(request, {
    store: (eventName) => {
      const retention = readPublicSiteRetentionPolicy(process.env);
      if (!retention) {
        throw new Error("Public-site retention is not configured");
      }
      return storePublicSiteEvent(getD1(), eventName, new Date(), retention);
    },
  });
}

export function OPTIONS() {
  return methodNotAllowed("POST");
}
