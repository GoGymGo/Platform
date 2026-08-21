# Public conversion release gate

This runbook governs the public landing routes and their links into the member
web experience. Repository completion does not authorize a Sites, Firebase,
AWS, DNS, analytics, legal, reward, or production release.

## Fail-closed release configuration

- `NEXT_PUBLIC_MEMBER_APP_ORIGIN` must be the exact approved
  `https://app.gogymgo.com` origin in a production build. Paths, queries,
  fragments, credentials, ports, HTTP, private hosts, preview hosts, and other
  domains are rejected. When the value is absent or rejected, the public site
  renders member-app, demo, rules, privacy, terms, recovery, and account-data
  destinations as unavailable text rather than guessing a URL.
- `NEXT_PUBLIC_SEPTEMBER_PILOT_PUBLISHED` must remain unset or `no` until the
  authoritative September Contest, current public legal documents, and exact
  sole GoGymGo-sponsored $100 CAD manual-handoff reward are approved and
  published. Only the exact value `yes` enables registration/active language.
  The calendar never proves publication.
- `GOGYMGO_API_URL` remains separately required for public intake. A form
  receipt means only that the validated request reached the authoritative API;
  it is not contest registration, partnership approval, or a response-time
  commitment.

## Exact journeys to verify after configuration

1. Confirm every landing CTA reaches only one of the canonical member routes:
   `/join`, `/demo`, `/official-rules`, `/privacy-policy`,
   `/terms-of-service`, `/forgot-password`, or `/account-data`.
2. Confirm `/demo` stays in isolated sample-data mode across direct entry,
   previous/next/menu navigation, refresh, and the exit-to-join action. It must
   not initialize Firebase, call the GoGymGo API, request camera or location,
   or write authoritative account, workout, reward, or provider data.
3. Confirm `/join` remains the sole player account entry and keeps sponsor and
   Partner-gym applications on their existing member or landing paths. The
   landing site must not acquire an account store or a second demo.
4. Confirm `/partners?interest=gym#partner-form` and
   `/partners?interest=brand#partner-form` choose the expected public intake
   option without implying approval or an active partnership.
5. Crawl the canonical landing origin and verify canonical metadata, social
   cards, `robots.txt`, `sitemap.xml`, 404 handling, deep links, response
   headers, and the absence of private, loopback, preview, internal, fixture,
   credential, and token strings.
6. Complete hosted keyboard, screen-reader, zoom, reduced-motion, contrast,
   responsive, and link checks against the exact candidate artifact. Record the
   approved legal/reward copy and asset digests with the release evidence.

## External blockers

Production remains blocked until the final hosting mappings and TLS are
verified, the member-web/API/Firebase release is available, the legal and cash
reward publication gates pass with approved assets, and authorized hosted
crawl/link/accessibility UAT succeeds. Conversion-event retention/export and
feedback persistence remain owned by GGG-026 and are not enabled or changed by
this release gate.
