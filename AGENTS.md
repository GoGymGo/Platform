# GoGymGo repository instructions

## Member app UI/UX scope

Unless the user explicitly narrows the request, an app UI/UX change means the
shared member experience in `apps/member-app` across browser, iOS and Android.
Keep screen content, terminology, hierarchy and core flows aligned on all three
platforms. Platform-specific behavior is allowed where hardware, permissions,
notifications, safe areas or navigation conventions require it, but document
intentional differences rather than silently creating a second product flow.

The connected browser build at `app.gogymgo.com` is the real-world pilot and
testing release target. Native iOS and Android builds should remain ready to
mirror shared changes, but they are not deployed unless the user specifically
requests a native build or release. App UI/UX work does not include the landing
site, admin console or standalone demo unless the user includes those surfaces.

## Member release channels

Treat browser and native publishing as independent release channels even though
they share one Expo codebase:

- Before publishing `app.gogymgo.com`, read
  [`docs/operations/member-web-deployment.md`](docs/operations/member-web-deployment.md)
  and run the browser build and deployment gates. Missing Apple or Android
  signing identifiers do not block a browser-only release. When they are absent,
  omit native association files and do not claim installed-app QR opening is
  live.
- Before generating native domain-association files or building/releasing signed
  iOS or Android apps, read
  [`docs/operations/member-app-native-links.md`](docs/operations/member-app-native-links.md).
  Do not publish placeholder native identifiers. A native production release
  must pass `npm.cmd run audit:release --workspace @gogymgo/member-app` with the
  real release environment.

When a request is scoped to the public landing site, do not modify or deploy the
member app.
