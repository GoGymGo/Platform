/**
 * Build the only upstream URL shape accepted by the admin proxy.
 *
 * @param {string} baseUrl
 * @param {string[]} path
 * @param {string} search
 */
export function buildUpstreamUrl(baseUrl, path, search = "") {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const versionedBaseUrl = normalizedBaseUrl.endsWith("/v1")
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/v1`;
  const target = new URL(
    `${versionedBaseUrl}/${path.map(encodeURIComponent).join("/")}`,
  );
  target.search = search;
  return target;
}
