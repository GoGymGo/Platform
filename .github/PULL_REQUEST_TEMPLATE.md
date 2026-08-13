## Outcome

Describe the user or operator outcome delivered by this change.

## Scope

- [ ] Member app
- [ ] Admin
- [ ] Landing
- [ ] API / worker / database
- [ ] Shared brand or contracts
- [ ] Infrastructure / deployment
- [ ] Documentation / compliance

## Validation

List the exact root or workspace commands run and their results.

## Boundaries

List each runtime owner changed. If CI requires a broad-change plan, link the
file under `docs/change-plans/` and explain why the coordination is indivisible.

## Release and risk

- [ ] I am authorized to submit this work under GoGymGo's applicable confidentiality and intellectual-property terms.
- [ ] No environment file, credential, database dump, Terraform state, deployment archive or generated production bundle is included.
- [ ] OpenAPI contracts were regenerated when required.
- [ ] Database changes are forward-only and operationally documented.
- [ ] Production deployment remains a manual, environment-gated action.
