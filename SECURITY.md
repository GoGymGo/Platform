# Security Policy

GoGymGo Platform is publicly viewable, proprietary, and pre-release. Report
suspected vulnerabilities through GitHub's private vulnerability reporting form
under the repository **Security** tab. Do not open a public issue or include
secrets, personal data, access tokens, or exploit details in screenshots or logs.

## Supported code

Security fixes target the current `main` branch and active staging/production deployment only.

## Required controls

- Firebase authentication is verified by the API; clients are not authoritative.
- Admin access requires the database role and the configured email access gate.
- Staging and production use separate projects, databases, secrets and deployment identities.
- Raw location coordinates are neither retained nor logged for QR verification.
- Secrets belong in environment-scoped secret stores, never Git or Terraform state.
- Production images are immutable digest-pinned artifacts deployed by manual workflow dispatch.
- GitHub Actions dependencies are commit-SHA pinned and receive minimum permissions.

If a credential is exposed, revoke and rotate it immediately, preserve minimal incident evidence, and follow the incident runbook under `docs/operations/`.
