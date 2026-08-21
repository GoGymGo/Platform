import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  exportLandingInterestPage,
  readLandingInterestExportConfig,
  readLandingInterestExportPageRequest,
} from "@/app/api/landing-intake-export";
import { getD1 } from "@/db";
import {
  exportHeaders,
  isAuthorizedPublicSiteOwner,
  ownerError,
  readPublicSiteOwnerConfig,
  unavailableOwnerRoute,
} from "../public-site-owner";

export async function GET(request: Request) {
  const owner = readPublicSiteOwnerConfig(
    process.env,
    "LANDING_D1_EXPORT_ENABLED",
  );
  const exportConfig = readLandingInterestExportConfig(process.env);
  if (!owner || !exportConfig) {
    return unavailableOwnerRoute();
  }

  const user = await getChatGPTUser();
  if (!user) {
    return ownerError("Authentication is required.", 401);
  }
  if (!(await isAuthorizedPublicSiteOwner(user, owner))) {
    return ownerError(
      "This export is restricted to the configured site owner.",
      403,
    );
  }

  const page = readLandingInterestExportPageRequest(request, exportConfig);
  if (!page) {
    return ownerError("Use a valid export limit and cursor.", 400);
  }

  try {
    const exported = await exportLandingInterestPage(
      getD1(),
      exportConfig,
      page,
    );
    return new Response(`${JSON.stringify(exported)}\n`, {
      headers: exportHeaders(
        `landing-interest-${exportConfig.exportId}-page-${page.sequence}.json`,
      ),
      status: 200,
    });
  } catch {
    return ownerError(
      "The historical submission export is temporarily unavailable.",
      503,
    );
  }
}
