# Firebase AWS workload identity federation

This bootstrap configures keyless Firebase Authentication access from the
isolated GoGymGo staging AWS account. It does not link a Google billing account,
start a Google free trial, create Google Cloud workloads, or create a
service-account key. Google IAM and Workload Identity Federation have no IAM
usage charge; Firebase Authentication remains subject to the existing Firebase
project's plan and quotas.

The script is deliberately fixed to these staging boundaries:

- Firebase project: `gogymgo-8cb8b`
- AWS account: `340700539877`
- accepted AWS roles: `gogymgo-staging-api` and `gogymgo-staging-worker`
- Firebase permissions: `firebaseauth.users.get` and
  `firebaseauth.users.delete`

Run it only in Google Cloud Shell while authenticated to an owner or suitably
privileged account for the existing Firebase project:

```bash
./setup.sh plan
./setup.sh apply
./setup.sh verify
```

The `plan` mode is read-only. The `apply` mode enables only the identity-related
APIs, reconciles the custom role, service account, pool, provider, and IAM
bindings, then runs the same verification as `verify` mode. Verification fails
unless both AWS role bindings exist, the provider has the exact account/role
condition, the service account has zero user-managed keys, and Google billing is
confirmed disabled. Both `apply` and `verify` refuse to continue if billing is
enabled or cannot be checked; they never attempt to change billing.

The resulting audience and service-account impersonation URL are non-secret.
Combine them into the AWS external-account JSON only after verification, then
store that JSON directly in the existing staging
`FIREBASE_SERVICE_ACCOUNT_JSON` Secrets Manager container. Never create or
download a service-account private key.
