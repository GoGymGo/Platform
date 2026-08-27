# Contest setup defaults and optional reward images

## Outcome

Allow an operator to publish an ordinary contest reward without supplying a
custom image or repeatedly entering a terms URL. The API stores the public
GoGymGo Terms of Service when no override is provided, and the member app uses
its existing built-in reward illustration when an image is absent. Location
detection failures leave manual contest-region selection available and present
that path as a neutral fallback instead of a blocking error.

## Boundaries

- The change is limited to the admin contest/reward forms, reward API contracts
  and publication behavior, the reward marketplace label, and one forward
  database constraint migration.
- Terms remain mandatory for every published reward; the generic public terms
  URL supplies that requirement unless an admin enters a specific HTTPS URL.
- The exact September 2026 Island Pilot retains its stricter approved image and
  terms policy. Coupon inventory and physical fulfillment gates are unchanged.
- No existing contest, reward, member, or staging data is modified by the
  repository change or pull request.

## Rollout

1. Merge only after all required pull-request checks pass for the exact commit.
2. Publish the merged admin artifact through the protected admin hosting path.
3. Use the protected staging platform workflow to register and execute the
   forward constraint migration before deploying the matching API and worker.
4. Validate the admin form, public reward response, member fallback image,
   service readiness, and current monitoring without creating test contests.

## Validation

- Admin typecheck, lint, production build, rendered-source safeguards, and tests.
- Member-app typecheck, lint, 275 tests, source audits, and nullable image
  contract coverage.
- API formatting, typecheck, lint, 421 unit tests, 31 end-to-end tests, generated
  OpenAPI contracts, build, and production artifact audits.
- A PostgreSQL integration specification proves that a published reward may
  omit an image while a missing terms URL still violates the named constraint.
  Run it in CI or another environment with a working container runtime.

## Recovery

If the migration or service deployment fails, keep the current API and worker
revisions active and stop the release. Do not automatically run the down
migration or edit reward rows. The prior runtime remains compatible because it
already renders nullable reward images; recover through the protected workflow
or a reviewed forward fix. If only the admin artifact fails validation, restore
the previously attested artifact through the hosting rollback path.
