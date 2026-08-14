# Role-scoped admin access

## Outcome

GoGymGo's invitation-only admin origin resolves one authoritative workspace from
the API after Firebase email/password authentication. Platform administrators
retain global controls; gym-partner administrators can mutate only their exact
active-gym assignments; partner staff remain read-only. Every operator request
rechecks the active PostgreSQL user, verified email, password sign-in provider,
database roles, assignment state, and gym state. Revocation therefore takes
effect without relying on cached navigation.

## Boundaries

This change coordinates the admin app, its same-origin proxy, API auth/operator
authorization, trusted owner/partner access scripts, generated contracts,
security audits, and operator runbooks. It does not add public registration,
social-provider admin login, public role management, dual-approval delegation,
or any GGG-021/022/023 configuration workflow. Administrator delegation remains
owner-operated and fail-closed until a separately approved second-person design
exists. Cloudflare Access remains an external outer release gate, not an
application authorization source.

## Rollout

1. Build and publish the admin and API from the same reviewed commit; apply no
   new database migration for this change.
2. Keep the trusted scripts in a secret-bearing administrative environment.
   They must validate the exact enabled, verified Firebase password account
   before changing PostgreSQL and must record every material change with its
   approved reason.
3. Verify the production Firebase authorized domain and email/password provider,
   and the Cloudflare Access allow/deny policy, through separately authorized
   release UAT. Do not infer either setting from repository tests.
4. Exercise owner, partner-admin, partner-staff, revoked-assignment, and ordinary
   member accounts against the exact release before promotion.

## Validation

- Admin request tests prove one forced-token retry after a 401 and no retry for
  authorization or upstream failures.
- Proxy tests cover exact operator paths, safe origins and queries, sensitive
  query rejection, bounded JSON bodies, forwarded-header allowlisting, manual
  redirect handling, and sanitized upstream failures.
- API unit tests cover ignored token role claims, password-provider enforcement,
  active/verified database users, platform/partner conflicts, exact assignment
  levels, and trusted Firebase identity validation.
- One serial, migrated PostgreSQL journey covers the platform/partner/member
  matrix, mixed scopes, cross-gym denial, assignment and gym revocation, partner
  draft limits, idempotency, and audit evidence.
- Admin rendered/direct-browser, source, generated contract, production artifact,
  dependency, governance, and full-root checks run from the exact PR head.

## Recovery

If access behavior regresses, roll back the admin and API together to the prior
known-good image. Do not repair roles or assignments with ad hoc SQL. Use the
trusted, reason-bound partner revocation command to remove compromised gym
access; revoke or disable the Firebase identity separately when identity risk is
present. Preserve operator audit rows and investigate forward. Cloudflare Access
may be used as an outer emergency deny gate by an authorized owner, but it does
not replace Firebase revocation or database-role/assignment recovery.
