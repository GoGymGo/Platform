import { methodNotAllowed } from "@/app/api/public-site-request";
import { storePublicSiteFeedback } from "@/app/api/public-site-storage";
import { readPublicSiteRetentionPolicy } from "@/app/public-site-policy";
import { getD1 } from "@/db";
import { handlePublicSiteFeedback } from "./handler";

export async function POST(request: Request) {
  return handlePublicSiteFeedback(request, {
    store: (feedback) => {
      const retention = readPublicSiteRetentionPolicy(process.env);
      if (!retention) {
        throw new Error("Public-site retention is not configured");
      }
      return storePublicSiteFeedback(getD1(), feedback, new Date(), retention);
    },
  });
}

export function OPTIONS() {
  return methodNotAllowed("POST");
}
