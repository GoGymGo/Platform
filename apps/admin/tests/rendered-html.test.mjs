import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(pathname, "http://localhost"), {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the GoGymGo administrator entry screen", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>GoGymGo Admin<\/title>/i);
  assert.match(html, /GoGymGo/);
  assert.match(html, /ADMIN CONTROL/);
  assert.match(
    html,
    /VERIFYING ADMIN ACCESS|Firebase sign-in has not been configured/,
  );
  assert.doesNotMatch(html, /CONTROL DECK ONLINE|SYSTEM OVERVIEW/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/i);
  assert.doesNotMatch(
    html,
    /Iron District|Volt Performance Club|Northline Fitness/i,
  );
});

test("keeps authorization and mutation safeguards in the implementation", async () => {
  const [dashboard, pilot, proxy, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/admin-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pilot-operations.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/gogymgo/[...path]/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /getIdToken\(\)/);
  assert.match(dashboard, /authorization:\s*`Bearer \$\{token\}`/);
  assert.match(dashboard, /Only active,/);
  assert.match(dashboard, /email-verified accounts/);
  assert.match(dashboard, /authoritative database admin role/);
  assert.match(dashboard, /name="reason"/);
  assert.match(dashboard, /ADMINISTRATIVE ACTION/);
  assert.match(dashboard, /idempotency-key/);
  assert.match(dashboard, /operator\/gym-locations/);
  assert.match(dashboard, /operator\/gym-sessions/);
  assert.match(dashboard, /operator\/region-waitlist/);
  assert.match(dashboard, /operator\/interest-submissions/);
  assert.match(dashboard, /operator\/partner-applications/);
  assert.match(dashboard, /operator\/cash-fulfillments/);
  assert.match(pilot, /STATIC QR PILOT/);
  assert.match(pilot, /DOWNLOAD SVG FOR PRINTING/);
  assert.match(pilot, /Sessions \+ incomplete visits/);
  assert.match(pilot, /owner|cash handoff/i);
  assert.doesNotMatch(pilot, /dangerouslySetInnerHTML/);

  assert.match(proxy, /path\[0\]\s*!==\s*"operator"/);
  assert.match(proxy, /This administrative route is not available/);
  assert.match(proxy, /GOGYMGO_API_URL/);
  assert.doesNotMatch(proxy, /firebase.*private|serviceAccount/i);

  assert.match(layout, /GoGymGo Admin/);
  assert.match(layout, /new URL\("\/og\.png", origin\)/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("../public/icon.png", import.meta.url));
  await access(new URL("../public/fonts/Orbitron-Bold.ttf", import.meta.url));
  await access(
    new URL("../public/fonts/ShareTechMono-Regular.ttf", import.meta.url),
  );
  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../.openai/hosting.json", import.meta.url));
});
