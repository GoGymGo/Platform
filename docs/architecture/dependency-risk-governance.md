# Dependency risk governance

GoGymGo uses one repository-wide dependency audit because npm workspaces share a
single lockfile and transitive packages can cross application boundaries. Run:

```sh
npm run audit:dependencies
```

The audit fails when it finds a new advisory, a mismatched advisory, an expired
or unused exception, or a vulnerability path that cannot be traced to an exact
approved advisory. `config/dependency-risk-exceptions.json` is the only source
of temporary approvals. Each approval records its exposure, remediation path,
compensating controls, upstream patched version when one exists, and a review
deadline no more than 45 days away.

Platform Integration runs the audit on every pull request and push to `main`.
The existing weekly Admin schedule reruns the same central gate so expiry and
new advisory metadata are detected even when the repository is idle.

The exception list is not a claim that the dependencies are safe. It records
known residual risk while a safe upgrade path is unavailable or requires a
separately tested migration. The member and admin production-bundle audits
remain required and provide a second check that build tooling does not leak
into deployed browser artifacts.

Dependabot opens routine npm and GitHub Actions patch/minor updates. SemVer major
updates are deliberately excluded from automatic version-update PRs because
they require release-note review, an owner-specific migration plan, and focused
compatibility tests. Vinext minor updates are also excluded while it is below
1.0. Security updates remain enabled and are evaluated independently from those
version-update limits.

When resolving an exception:

1. Remove or upgrade the vulnerable dependency without using a forced downgrade.
2. Run the owner checks, critical journey tests, and production artifact audit.
3. Remove the exact exception in the same pull request.
4. Run `npm run audit:dependencies` and the complete `npm run check` gate.
