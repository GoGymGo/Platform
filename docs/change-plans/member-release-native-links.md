# GGG-028 browser pilot and native-link handoff

## Outcome

The member web release produces one attestable static artifact from an exact
reviewed main commit. Browser-pilot publication keeps poster QR codes in the
HTTPS experience and proves native association files are absent. A separate
production-only native-link mode can publish exact Apple and Android association
documents only after every authoritative identifier, signing fingerprint, EAS
project, store listing, legal URL, and explicit approval value is present.

Incoming `/scan` credentials fail closed across the member route, QR camera, and
admin poster response. Landing copy describes the current browser destination
honestly until native publication and physical-device acceptance are complete.

## Boundaries

This change spans member app, admin, landing, GitHub release workflows, and AWS
hosting infrastructure because those owners jointly generate, describe,
publish, and consume the same canonical QR URL. The association surface is
limited to `https://app.gogymgo.com/scan`; no other member route is delegated to
native clients.

The repository stores no final native identifier, team, signing, EAS, or store
value. This work does not inspect or contact Docker, databases, AWS, CloudFront,
S3, Firebase, EAS, Apple, Google Play, DNS, credentials, signing systems, native
builds, submissions, deployments, or real data. It does not enable release
approval or edit the coordinator ledger.

## Rollout

1. Merge repository readiness only after serial workspace checks, browser-pilot
   export audits, artifact attestation, local browser validation, and protected
   repository CI pass on the unchanged head.
2. Under separate deployment authorization, publish a browser-pilot artifact
   through the `member-web` scope from an exact reviewed main SHA. Confirm public
   SPA bytes and 403/404 for both association URLs.
3. Separately finalize and approve provider-owned native identifiers, signing
   fingerprints, EAS project, listings, and legal URLs; create signed candidates
   and match their identifiers to the protected values.
4. Dispatch `member-native-links` only to the protected production environment.
   Confirm exact association bytes and content types, then install the signed
   candidates and complete physical iPhone and Android poster tests.
5. Describe native QR handoff as live only after the device evidence is recorded.

## Validation

Run member release-policy, workflow-contract, static-attestation, link parser,
admin decoder, and landing rendered-copy tests. Run the member, admin, and
landing type/lint/test/build gates, architecture/governance/dependency/source
audits, a clean browser-pilot production export with exact staging API origin,
and attestation create/verify. Serve only one local export process at a time and
validate the welcome/demo and malformed scan paths with the in-app browser.

Native publication is validated negatively without synthetic production values:
the release audit must remain blocked and list the absent authoritative inputs.
Provider deployment, native builds, signing, store submission, and physical
device UAT remain external gates.

## Recovery

The web workflow captures the prior entrypoint and association objects, uploads
assets before the entrypoint, preserves prior hashed assets, verifies exact
public bytes, and automatically restores the captured state on failure. A later
incident uses a reviewed browser-pilot release to remove associations and retain
the HTTPS fallback; no association or entrypoint is edited manually.

Native clients and store listings have separate rollback procedures tied to the
exact signed-build release record. Repository rollback leaves provider-owned
identifiers and evidence intact, keeps native approval disabled, and reverts the
application/workflow commit through the normal reviewed path.
