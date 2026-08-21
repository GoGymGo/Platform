import {
  handleRegionalUpdates,
} from "../landing-intake-request";
import { methodNotAllowed } from "../public-site-request";

export async function POST(request: Request) {
  return handleRegionalUpdates(request);
}

export function GET() {
  return methodNotAllowed("POST");
}

export const DELETE = GET;
export const PATCH = GET;
export const PUT = GET;
