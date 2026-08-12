# GoGymGo repository instructions

## Member app deployment guard

Before deploying `apps/member-app`, publishing `app.gogymgo.com`, or building a
signed iOS or Android release, read
[`docs/operations/member-app-native-links.md`](docs/operations/member-app-native-links.md).

Do not claim that phone-camera QR links are production-ready and do not publish
placeholder native identifiers. A production member release must pass
`npm.cmd run audit:release --workspace @gogymgo/member-app` with the real release
environment.

A browser-only pilot may publish `app.gogymgo.com` without native signing
identifiers only through the protected member-web workflow. Its exact export
must pass `npm.cmd run audit:browser-pilot-release --workspace
@gogymgo/member-app -- dist`, omit both native association files, and be
described as an HTTPS browser experience rather than an installed-app handoff.

When a request is scoped to the public landing site, do not modify or deploy the
member app.
