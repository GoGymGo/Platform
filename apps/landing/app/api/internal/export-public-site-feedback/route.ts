import { getChatGPTUser } from "@/app/chatgpt-auth";
import { exportPublicSiteFeedback } from "@/app/api/public-site-storage";
import { readPublicSiteRetentionPolicy } from "@/app/public-site-policy";
import { getD1 } from "@/db";
import {
  exportHeaders,
  isAuthorizedPublicSiteOwner,
  ownerError,
  readFeedbackExportPage,
  readPublicSiteOwnerConfig,
  unavailableOwnerRoute,
} from "../public-site-owner";

export async function GET(request: Request) {
  const owner = readPublicSiteOwnerConfig(
    process.env,
    "LANDING_D1_EXPORT_ENABLED",
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
    return ownerError("This export is restricted to the configured site owner.", 403);
  }

  const page = readFeedbackExportPage(request);
  if (!page) {
    return ownerError("Use a valid export limit and cursor.", 400);
  }

  try {
    const exported = await exportPublicSiteFeedback(
      getD1(),
      page,
      new Date(),
      retention.feedbackDays,
    );
    return new Response(
      `${JSON.stringify({
        next_cursor: exported.nextCursor,
        results: exported.results,
      })}\n`,
      {
        headers: exportHeaders("landing-public-site-feedback.json"),
        status: 200,
      },
    );
  } catch {
    return ownerError(
      "The public-site feedback export is temporarily unavailable.",
      503,
    );
  }
}
