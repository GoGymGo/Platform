#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SETUP_SCRIPT="${SCRIPT_DIR}/setup.sh"

gcloud() {
  case "$*" in
    "auth list --filter=status:ACTIVE --format=value(account)")
      printf 'firebase-owner@example.com\n'
      ;;
    "projects describe gogymgo-8cb8b --format=value(projectNumber) --project=gogymgo-8cb8b")
      printf '123456789012\n'
      ;;
    "billing projects describe gogymgo-8cb8b --format=value(billingEnabled)")
      printf '%s\n' "${FAKE_BILLING_ENABLED:-False}"
      ;;
    *)
      printf 'Unexpected gcloud mutation or query in guarded test: %s\n' "$*" >&2
      return 88
      ;;
  esac
}
export -f gcloud

bash -n "$SETUP_SCRIPT"

plan_output="$(FAKE_BILLING_ENABLED=False bash "$SETUP_SCRIPT" plan)"
grep -Fx 'PROJECT_ID=gogymgo-8cb8b' <<<"$plan_output" >/dev/null
grep -Fx 'AWS_ACCOUNT_ID=340700539877' <<<"$plan_output" >/dev/null
grep -Fx 'AWS_ROLES=gogymgo-staging-api,gogymgo-staging-worker' <<<"$plan_output" >/dev/null
grep -Fx 'GOOGLE_BILLING_ENABLED=False' <<<"$plan_output" >/dev/null
grep -Fx 'PLAN=grant only firebaseauth.users.get and firebaseauth.users.delete' <<<"$plan_output" >/dev/null
grep -Fx 'PLAN=do not link billing, start a trial, or create a service-account key' <<<"$plan_output" >/dev/null

if FAKE_BILLING_ENABLED=True bash "$SETUP_SCRIPT" apply >/dev/null 2>&1; then
  printf 'Expected apply to refuse a billing-enabled Google project.\n' >&2
  exit 1
fi

if FAKE_BILLING_ENABLED=unknown bash "$SETUP_SCRIPT" apply >/dev/null 2>&1; then
  printf 'Expected apply to refuse an unverified Google billing state.\n' >&2
  exit 1
fi

if grep -Eq 'billing projects (link|unlink)|service-accounts keys create' "$SETUP_SCRIPT"; then
  printf 'The staging setup must not change Google billing or create service-account keys.\n' >&2
  exit 1
fi

printf 'firebase-wif guarded tests: PASS\n'
