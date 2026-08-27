const sensitiveQueryNames = new Set([
  "access_token",
  "authorization",
  "credential",
  "id_token",
  "password",
  "refresh_token",
  "secret",
  "token",
]);

/** @param {string[]} path */
export function isAllowedAdminProxyPath(path) {
  return (
    path.length >= 2 &&
    path[0] === "operator" &&
    path.every(
      (segment) =>
        typeof segment === "string" && /^[A-Za-z0-9_-]+$/.test(segment),
    )
  );
}

/** @param {string} baseUrl */
export function parseAdminApiBaseUrl(baseUrl) {
  const parsed = new URL(baseUrl);
  const localHttp =
    parsed.protocol === "http:" &&
    ["127.0.0.1", "::1", "localhost"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !localHttp) {
    throw new Error("The admin API origin must use HTTPS.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(
      "The admin API origin must not contain credentials or query data.",
    );
  }
  const pathname = parsed.pathname.replace(/\/+$/, "");
  if (pathname && pathname !== "/v1") {
    throw new Error(
      "The admin API URL must be an origin with an optional /v1 path.",
    );
  }
  return `${parsed.origin}/v1`;
}

/** @param {string} search */
export function validatedAdminProxySearch(search = "") {
  if (search.length > 2_048) {
    throw new Error("The admin API query is too long.");
  }
  const parameters = new URLSearchParams(search);
  for (const name of parameters.keys()) {
    if (sensitiveQueryNames.has(name.toLowerCase())) {
      throw new Error(
        "Authentication material is not allowed in the query string.",
      );
    }
  }
  const encoded = parameters.toString();
  return encoded ? `?${encoded}` : "";
}

/** @param {number} status @param {string} body */
export function isEmptySuccessfulAdminResponse(status, body) {
  return status >= 200 && status < 300 && body.trim().length === 0;
}

/**
 * Build the only upstream URL shape accepted by the admin proxy.
 *
 * @param {string} baseUrl
 * @param {string[]} path
 * @param {string} search
 */
export function buildUpstreamUrl(baseUrl, path, search = "") {
  if (!isAllowedAdminProxyPath(path)) {
    throw new Error("The administrative route is not available.");
  }
  const versionedBaseUrl = parseAdminApiBaseUrl(baseUrl);
  const target = new URL(
    `${versionedBaseUrl}/${path.map(encodeURIComponent).join("/")}`,
  );
  target.search = validatedAdminProxySearch(search);
  return target;
}
