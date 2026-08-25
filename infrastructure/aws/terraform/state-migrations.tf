# Preserve the shared execution role while the running API and worker still use
# legacy task-definition revisions. Remove these resources only after a protected
# deployment proves every service has moved to a runtime-scoped execution role.
moved {
  from = aws_iam_role.ecs_execution
  to   = aws_iam_role.ecs_execution_legacy
}

moved {
  from = aws_iam_role_policy.ecs_execution
  to   = aws_iam_role_policy.ecs_execution_legacy
}
