#!/usr/bin/env bash

set -Eeuo pipefail

readonly PROJECT_ID="gogymgo-8cb8b"
readonly AWS_ACCOUNT_ID="340700539877"
readonly POOL_ID="gogymgo-staging-aws"
readonly PROVIDER_ID="gogymgo-staging-ecs"
readonly SERVICE_ACCOUNT_ID="gogymgo-staging-firebase"
readonly CUSTOM_ROLE_ID="gogymgoStagingFirebaseRuntime"
readonly API_ROLE_NAME="gogymgo-staging-api"
readonly WORKER_ROLE_NAME="gogymgo-staging-worker"
readonly LOCATION="global"

usage() {
  printf 'Usage: %s plan|apply|verify\n' "$0"
}

mode="${1:-plan}"
if [[ "$mode" != "plan" && "$mode" != "apply" && "$mode" != "verify" ]]; then
  usage >&2
  exit 2
fi

PYTHON_BIN="${PYTHON_BIN:-python3}"

for command_name in gcloud "$PYTHON_BIN"; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Required command is unavailable: %s\n' "$command_name" >&2
    exit 1
  fi
done

active_account="$(gcloud auth list --filter='status:ACTIVE' --format='value(account)' | head -n 1)"
if [[ -z "$active_account" ]]; then
  printf 'No active Google Cloud account is authenticated.\n' >&2
  exit 1
fi

project_number="$(
  gcloud projects describe "$PROJECT_ID" \
    --format='value(projectNumber)' \
    --project="$PROJECT_ID"
)"
if [[ ! "$project_number" =~ ^[1-9][0-9]*$ ]]; then
  printf 'Could not resolve the expected Firebase project number.\n' >&2
  exit 1
fi

billing_enabled="$(
  gcloud billing projects describe "$PROJECT_ID" \
    --format='value(billingEnabled)' 2>/dev/null || printf 'unknown'
)"

readonly SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
readonly PROVIDER_RESOURCE="projects/${project_number}/locations/${LOCATION}/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"
readonly PRINCIPAL_PREFIX="principalSet://iam.googleapis.com/projects/${project_number}/locations/${LOCATION}/workloadIdentityPools/${POOL_ID}/attribute.aws_role"
readonly ATTRIBUTE_MAPPING="google.subject=assertion.arn,attribute.aws_account=assertion.account,attribute.aws_role=assertion.arn.extract('assumed-role/{role_name}/')"
readonly ATTRIBUTE_CONDITION="attribute.aws_account == '${AWS_ACCOUNT_ID}' && attribute.aws_role in ['${API_ROLE_NAME}', '${WORKER_ROLE_NAME}']"
readonly CUSTOM_ROLE_NAME="projects/${PROJECT_ID}/roles/${CUSTOM_ROLE_ID}"

print_scope() {
  printf 'ACTIVE_ACCOUNT=%s\n' "$active_account"
  printf 'PROJECT_ID=%s\n' "$PROJECT_ID"
  printf 'PROJECT_NUMBER=%s\n' "$project_number"
  printf 'GOOGLE_BILLING_ENABLED=%s\n' "$billing_enabled"
  printf 'AWS_ACCOUNT_ID=%s\n' "$AWS_ACCOUNT_ID"
  printf 'AWS_ROLES=%s,%s\n' "$API_ROLE_NAME" "$WORKER_ROLE_NAME"
  printf 'SERVICE_ACCOUNT=%s\n' "$SERVICE_ACCOUNT_EMAIL"
  printf 'PROVIDER=%s\n' "$PROVIDER_RESOURCE"
}

require_google_billing_disabled() {
  if [[ "${billing_enabled,,}" != "false" ]]; then
    printf 'Refusing to continue: Google billing must be confirmed disabled; observed %s.\n' "$billing_enabled" >&2
    printf 'This guard prevents staging identity setup from relying on a Google billing account or card.\n' >&2
    exit 1
  fi
}

verify_configuration() {
  local provider_account_id
  local provider_condition
  local provider_json
  local provider_mapping_account
  local provider_mapping_subject
  local provider_mapping_role
  local project_policy_json
  local service_account_policy_json
  local service_account_key_count

  require_google_billing_disabled

  gcloud iam workload-identity-pools describe "$POOL_ID" \
    --location="$LOCATION" \
    --project="$PROJECT_ID" \
    --format='value(name)' >/dev/null

  provider_json="$(
    gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
      --location="$LOCATION" \
      --workload-identity-pool="$POOL_ID" \
      --project="$PROJECT_ID" \
      --format='json'
  )"
  provider_account_id="$("$PYTHON_BIN" -c 'import json,sys; print(json.load(sys.stdin)["aws"]["accountId"])' <<<"$provider_json")"
  provider_condition="$("$PYTHON_BIN" -c 'import json,sys; print(json.load(sys.stdin)["attributeCondition"])' <<<"$provider_json")"
  provider_mapping_account="$(
    "$PYTHON_BIN" -c 'import json,sys; print(json.load(sys.stdin)["attributeMapping"]["attribute.aws_account"])' <<<"$provider_json"
  )"
  provider_mapping_subject="$(
    "$PYTHON_BIN" -c 'import json,sys; print(json.load(sys.stdin)["attributeMapping"]["google.subject"])' <<<"$provider_json"
  )"
  provider_mapping_role="$(
    "$PYTHON_BIN" -c 'import json,sys; print(json.load(sys.stdin)["attributeMapping"]["attribute.aws_role"])' <<<"$provider_json"
  )"

  [[ "$provider_account_id" == "$AWS_ACCOUNT_ID" ]]
  [[ "$provider_condition" == "$ATTRIBUTE_CONDITION" ]]
  [[ "$provider_mapping_account" == 'assertion.account' ]]
  [[ "$provider_mapping_subject" == 'assertion.arn' ]]
  [[ "$provider_mapping_role" == "assertion.arn.extract('assumed-role/{role_name}/')" ]]

  gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" \
    --project="$PROJECT_ID" \
    --format='value(email)' >/dev/null

  service_account_policy_json="$(
    gcloud iam service-accounts get-iam-policy "$SERVICE_ACCOUNT_EMAIL" \
      --project="$PROJECT_ID" \
      --format='json'
  )"
  for role_name in "$API_ROLE_NAME" "$WORKER_ROLE_NAME"; do
    "$PYTHON_BIN" -c \
      'import json,sys; policy=json.load(sys.stdin); role=sys.argv[1]; member=sys.argv[2]; sys.exit(0 if any(b.get("role") == role and member in b.get("members", []) for b in policy.get("bindings", [])) else 1)' \
      'roles/iam.workloadIdentityUser' "${PRINCIPAL_PREFIX}/${role_name}" <<<"$service_account_policy_json"
  done

  project_policy_json="$(
    gcloud projects get-iam-policy "$PROJECT_ID" \
      --format='json'
  )"
  "$PYTHON_BIN" -c \
    'import json,sys; policy=json.load(sys.stdin); role=sys.argv[1]; member=sys.argv[2]; sys.exit(0 if any(b.get("role") == role and member in b.get("members", []) for b in policy.get("bindings", [])) else 1)' \
    "$CUSTOM_ROLE_NAME" "serviceAccount:${SERVICE_ACCOUNT_EMAIL}" <<<"$project_policy_json"

  service_account_key_count="$(
    gcloud iam service-accounts keys list \
      --iam-account="$SERVICE_ACCOUNT_EMAIL" \
      --project="$PROJECT_ID" \
      --managed-by='user' \
      --format='value(name)' | sed '/^$/d' | wc -l | tr -d ' '
  )"
  [[ "$service_account_key_count" == "0" ]]

  printf 'VERIFICATION=PASS\n'
  printf 'USER_MANAGED_SERVICE_ACCOUNT_KEYS=0\n'
  printf 'AUDIENCE=//iam.googleapis.com/%s\n' "$PROVIDER_RESOURCE"
  printf 'SERVICE_ACCOUNT_IMPERSONATION_URL=https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/%s:generateAccessToken\n' "$SERVICE_ACCOUNT_EMAIL"
}

print_scope

if [[ "$mode" == "plan" ]]; then
  printf 'PLAN=enable IAM, IAM Credentials, STS, Service Usage, and Identity Toolkit APIs only\n'
  printf 'PLAN=create or reconcile one staging workload identity pool and one AWS provider\n'
  printf 'PLAN=restrict the provider to AWS account %s and roles %s,%s\n' "$AWS_ACCOUNT_ID" "$API_ROLE_NAME" "$WORKER_ROLE_NAME"
  printf 'PLAN=create or reconcile one staging Firebase service account\n'
  printf 'PLAN=grant only firebaseauth.users.get and firebaseauth.users.delete\n'
  printf 'PLAN=grant workloadIdentityUser only to the two mapped AWS role principal sets\n'
  printf 'PLAN=do not link billing, start a trial, or create a service-account key\n'
  exit 0
fi

if [[ "$mode" == "verify" ]]; then
  verify_configuration
  exit 0
fi

require_google_billing_disabled

gcloud services enable \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  serviceusage.googleapis.com \
  identitytoolkit.googleapis.com \
  --project="$PROJECT_ID" \
  --quiet

if gcloud iam roles describe "$CUSTOM_ROLE_ID" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam roles update "$CUSTOM_ROLE_ID" \
    --project="$PROJECT_ID" \
    --title='GoGymGo staging Firebase runtime' \
    --description='Read and delete Firebase Auth users for verified sessions and privacy erasure.' \
    --permissions='firebaseauth.users.get,firebaseauth.users.delete' \
    --stage='GA' \
    --quiet
else
  gcloud iam roles create "$CUSTOM_ROLE_ID" \
    --project="$PROJECT_ID" \
    --title='GoGymGo staging Firebase runtime' \
    --description='Read and delete Firebase Auth users for verified sessions and privacy erasure.' \
    --permissions='firebaseauth.users.get,firebaseauth.users.delete' \
    --stage='GA' \
    --quiet
fi

if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SERVICE_ACCOUNT_ID" \
    --project="$PROJECT_ID" \
    --display-name='GoGymGo staging Firebase runtime' \
    --description='Keyless Firebase Auth access from the isolated GoGymGo staging ECS roles.' \
    --quiet
fi

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="$CUSTOM_ROLE_NAME" \
  --condition=None \
  --quiet >/dev/null

if ! gcloud iam workload-identity-pools describe "$POOL_ID" --location="$LOCATION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL_ID" \
    --location="$LOCATION" \
    --project="$PROJECT_ID" \
    --display-name='GoGymGo staging AWS' \
    --description='Keyless identities from the isolated GoGymGo staging AWS account.' \
    --quiet
fi

if gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --location="$LOCATION" \
  --workload-identity-pool="$POOL_ID" \
  --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers update-aws "$PROVIDER_ID" \
    --location="$LOCATION" \
    --workload-identity-pool="$POOL_ID" \
    --project="$PROJECT_ID" \
    --account-id="$AWS_ACCOUNT_ID" \
    --attribute-mapping="$ATTRIBUTE_MAPPING" \
    --attribute-condition="$ATTRIBUTE_CONDITION" \
    --display-name='GoGymGo staging ECS' \
    --description='Only the staging API and worker roles in AWS account 340700539877.' \
    --quiet
else
  gcloud iam workload-identity-pools providers create-aws "$PROVIDER_ID" \
    --location="$LOCATION" \
    --workload-identity-pool="$POOL_ID" \
    --project="$PROJECT_ID" \
    --account-id="$AWS_ACCOUNT_ID" \
    --attribute-mapping="$ATTRIBUTE_MAPPING" \
    --attribute-condition="$ATTRIBUTE_CONDITION" \
    --display-name='GoGymGo staging ECS' \
    --description='Only the staging API and worker roles in AWS account 340700539877.' \
    --quiet
fi

for role_name in "$API_ROLE_NAME" "$WORKER_ROLE_NAME"; do
  gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT_EMAIL" \
    --project="$PROJECT_ID" \
    --member="${PRINCIPAL_PREFIX}/${role_name}" \
    --role='roles/iam.workloadIdentityUser' \
    --condition=None \
    --quiet >/dev/null
done

verify_configuration
