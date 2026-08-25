import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("pins offline Terraform inputs and exact-version private storage", async () => {
  const [lock, storage, versions] = await Promise.all([
    read("infrastructure/aws/terraform/.terraform.lock.hcl"),
    read("infrastructure/aws/terraform/storage.tf"),
    read("infrastructure/aws/terraform/versions.tf"),
  ]);
  const lockedProvider = lock.match(
    /provider "[^"]+\/aws" \{[\s\S]*?version\s+=\s+"([^"]+)"/,
  )?.[1];

  assert.ok(lockedProvider, "AWS provider lock version is missing");
  assert.match(versions, /required_version\s*=\s*">= 1\.10\.0, < 1\.16\.0"/);
  assert.match(
    versions,
    new RegExp(`version\\s*=\\s*"= ${lockedProvider.replaceAll(".", "\\.")}"`),
  );
  assert.doesNotMatch(
    storage,
    /versioning_configuration\s*\{\s*status\s*=\s*"Suspended"/,
  );
  assert.equal(
    storage.match(
      /versioning_configuration\s*\{\s*status\s*=\s*"Enabled"\s*\}/g,
    )?.length,
    2,
  );
});

test("keeps runtime secrets role scoped and optional gates fail closed", async () => {
  const [environment, identity, locals, stateMigrations, workloads] =
    await Promise.all([
      read("services/api/src/config/environment.ts"),
      read("infrastructure/aws/terraform/identity.tf"),
      read("infrastructure/aws/terraform/locals.tf"),
      read("infrastructure/aws/terraform/state-migrations.tf"),
      read("infrastructure/aws/terraform/workloads.tf"),
    ]);
  const workerSecretStart = locals.indexOf(
    "worker_secret_environment = merge(",
  );
  const workerSecrets =
    workerSecretStart === -1 ? null : locals.slice(workerSecretStart);
  const legacyRole = identity.slice(
    identity.indexOf('resource "aws_iam_role" "ecs_execution_legacy"'),
    identity.indexOf('data "aws_iam_policy_document" "ecs_execution_legacy"'),
  );
  const legacyPolicy = identity.slice(
    identity.indexOf(
      'resource "aws_iam_role_policy" "ecs_execution_legacy"',
    ),
    identity.indexOf('resource "aws_iam_role" "ecs_execution_scoped"'),
  );

  assert.ok(workerSecrets, "worker secret map is missing");
  assert.doesNotMatch(workerSecrets, /REWARD_CODE_ENCRYPTION_KEY/);
  assert.match(locals, /LANDING_INTAKE_FORWARDING_SECRET/);
  assert.match(identity, /for_each = local\.execution_secret_arns/g);
  assert.match(identity, /resources = each\.value/);
  assert.match(
    legacyRole,
    /name\s*=\s*"\$\{local\.name\}-ecs-execution"[\s\S]*?prevent_destroy\s*=\s*true/,
  );
  assert.match(
    legacyPolicy,
    /name\s*=\s*"\$\{local\.name\}-ecs-execution"[\s\S]*?prevent_destroy\s*=\s*true/,
  );
  assert.match(
    identity,
    /data "aws_iam_policy_document" "ecs_execution_legacy"[\s\S]*?secretsmanager:GetSecretValue[\s\S]*?resources\s*=\s*values\(aws_secretsmanager_secret\.runtime\)\[\*\]\.arn/,
  );
  assert.match(
    identity,
    /resource "aws_iam_role" "ecs_execution_scoped"\s*\{\s*for_each = local\.execution_secret_arns/,
  );
  assert.match(
    identity,
    /resource "aws_iam_role_policy" "ecs_execution_scoped"\s*\{\s*for_each = local\.execution_secret_arns/,
  );
  assert.match(
    identity,
    /aws_iam_role\.ecs_execution_legacy\.arn[\s\S]*?values\(aws_iam_role\.ecs_execution_scoped\)\[\*\]\.arn/,
  );
  assert.match(
    identity,
    /ecr:DescribeImageScanFindings/,
    "The deployment role must be able to enforce the repository scan gate",
  );
  assert.match(
    stateMigrations,
    /from\s*=\s*aws_iam_role\.ecs_execution\s+to\s*=\s*aws_iam_role\.ecs_execution_legacy/,
  );
  assert.match(
    stateMigrations,
    /from\s*=\s*aws_iam_role_policy\.ecs_execution\s+to\s*=\s*aws_iam_role_policy\.ecs_execution_legacy/,
  );
  for (const runtime of ["api", "worker", "migration"]) {
    assert.match(
      workloads,
      new RegExp(
        `execution_role_arn\\s*=\\s*aws_iam_role\\.ecs_execution_scoped\\["${runtime}"\\]\\.arn`,
      ),
    );
  }
  assert.equal(
    workloads.match(/skip_destroy\s*=\s*true/g)?.length,
    3,
    "Every ECS task definition must retain prior rollback revisions",
  );
  assert.equal(
    workloads.match(/create_before_destroy\s*=\s*true/g)?.length,
    3,
    "Every ECS task definition must register its replacement before state advances",
  );
  assert.doesNotMatch(workloads, /aws_iam_role\.ecs_execution\[/);
  assert.match(
    locals,
    /execution_secret_arns = \{[\s\S]*api\s*= values\(local\.api_secret_environment\)[\s\S]*migration = \[aws_secretsmanager_secret\.runtime\["DATABASE_URL"\]\.arn\][\s\S]*worker\s*= values\(local\.worker_secret_environment\)/,
  );
  assert.match(
    environment,
    /environment\.RUNTIME_ROLE === 'api'[\s\S]*!environment\.REWARD_CODE_ENCRYPTION_KEY/,
  );
  assert.match(
    locals,
    /LANDING_INTAKE_ENABLED\s*=\s*tostring\(var\.landing_intake_enabled\)/,
  );
});

test("serializes releases and preserves complete rollback baselines", async () => {
  const workflow = await read(".github/workflows/deployment.yml");

  assert.match(
    workflow,
    /group: gogymgo-deploy-\$\{\{ inputs\.environment \}\}/,
  );
  assert.doesNotMatch(workflow, /group: gogymgo-deploy-\$\{\{ inputs\.scope/);
  assert.match(
    workflow,
    /persist-credentials: false\s+ref: \$\{\{ inputs\.source_commit \}\}/,
  );
  for (const name of [
    "API_PREVIOUS_TASK_DEFINITION",
    "API_PREVIOUS_DESIRED_COUNT",
    "WORKER_PREVIOUS_TASK_DEFINITION",
    "WORKER_PREVIOUS_DESIRED_COUNT",
  ]) {
    assert.match(workflow, new RegExp(name));
  }
  assert.match(workflow, /rollback_worker\(\)/);
  assert.match(workflow, /rollback_worker_on_error\(\)/);
  assert.match(workflow, /rollback_release\(\)/);
  assert.match(workflow, /rollback_release_on_error\(\)/);
  for (const runtime of ["api", "worker", "migration"]) {
    assert.match(
      workflow,
      new RegExp(`expected_${runtime}_execution_role`),
    );
  }
  assert.match(workflow, /worker_previous_status[\s\S]*?"ACTIVE"/);
  assert.match(workflow, /api_previous_status[\s\S]*?"ACTIVE"/);
  assert.match(workflow, /aws ecr wait image-scan-complete/);
  assert.match(workflow, /aws ecr describe-image-scan-findings/);
  assert.match(workflow, /zero HIGH or CRITICAL findings/);
  assert.doesNotMatch(
    workflow,
    /failed to stabilize and was returned to zero tasks/i,
  );
});

test("labels repository readiness and external recovery gates honestly", async () => {
  const [plan, recovery] = await Promise.all([
    read("docs/change-plans/ggg-030-aws-foundation-readiness.md"),
    read("docs/operations/aws-runtime-recovery.md"),
  ]);

  for (const heading of [
    "Outcome",
    "Boundaries",
    "Rollout",
    "Validation",
    "Recovery",
  ]) {
    assert.match(plan, new RegExp(`^## ${heading}$`, "m"));
  }
  assert.match(recovery, /not deployed-resource evidence/i);
  assert.match(recovery, /Read-only AWS reconciliation is a separate task/i);
  assert.match(recovery, /API autoscaling is intentionally absent/i);
  assert.match(recovery, /Repository completion remains `BLOCKED`/);
});
