resource "aws_ecs_cluster" "main" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# The member API is intentionally public; application authentication remains
# mandatory and tasks accept inbound traffic only from this load balancer.
#trivy:ignore:AVD-AWS-0053
resource "aws_lb" "api" {
  drop_invalid_header_fields = true
  enable_deletion_protection = var.deletion_protection
  internal                   = false
  load_balancer_type         = "application"
  name                       = "${local.name}-api"
  security_groups            = [aws_security_group.load_balancer.id]
  subnets                    = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "api" {
  deregistration_delay = 30
  name                 = "${local.name}-api"
  port                 = 3000
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/v1/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "https" {
  count = var.api_certificate_arn == null ? 0 : 1

  certificate_arn   = var.api_certificate_arn
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"

  default_action {
    target_group_arn = aws_lb_target_group.api.arn
    type             = "forward"
  }
}

resource "aws_ecs_task_definition" "api" {
  container_definitions = jsonencode([{
    environment = [for name, value in local.api_environment : { name = name, value = value }]
    essential   = true
    image       = var.container_image
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.application.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "api"
      }
    }
    name = "api"
    portMappings = [{
      appProtocol   = "http"
      containerPort = 3000
      hostPort      = 3000
      name          = "http"
      protocol      = "tcp"
    }]
    readonlyRootFilesystem = true
    secrets = [
      for name, value_from in local.api_secret_environment : {
        name      = name
        valueFrom = value_from
      }
    ]
  }])
  cpu                      = tostring(var.api_cpu)
  execution_role_arn       = aws_iam_role.ecs_execution["api"].arn
  family                   = "${local.name}-api"
  memory                   = tostring(var.api_memory)
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  task_role_arn            = aws_iam_role.api.arn

  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }

  lifecycle {
    create_before_destroy = true
    ignore_changes        = [container_definitions]
    replace_triggered_by  = [aws_iam_role_policy.ecs_execution["api"]]
    precondition {
      condition     = try(contains(local.fargate_memory_by_cpu[var.api_cpu], var.api_memory), false)
      error_message = "api_cpu and api_memory must form a supported bounded Fargate size."
    }
    precondition {
      condition     = !var.landing_intake_enabled || var.landing_intake_retention_days != null
      error_message = "landing_intake_retention_days is required when landing_intake_enabled is true."
    }
  }
}

resource "aws_ecs_task_definition" "worker" {
  container_definitions = jsonencode([{
    command = [
      "node",
      "--require",
      "./dist/observability/instrumentation.js",
      "dist/worker.js",
    ]
    environment = [for name, value in local.worker_environment : { name = name, value = value }]
    essential   = true
    image       = var.container_image
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.application.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "worker"
      }
    }
    name                   = "worker"
    readonlyRootFilesystem = true
    secrets = [
      for name, value_from in local.worker_secret_environment : {
        name      = name
        valueFrom = value_from
      }
    ]
  }])
  cpu                      = tostring(var.worker_cpu)
  execution_role_arn       = aws_iam_role.ecs_execution["worker"].arn
  family                   = "${local.name}-worker"
  memory                   = tostring(var.worker_memory)
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  task_role_arn            = aws_iam_role.worker.arn

  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }

  lifecycle {
    ignore_changes = [container_definitions]
    precondition {
      condition     = try(contains(local.fargate_memory_by_cpu[var.worker_cpu], var.worker_memory), false)
      error_message = "worker_cpu and worker_memory must form a supported bounded Fargate size."
    }
  }
}

resource "aws_ecs_task_definition" "migration" {
  container_definitions = jsonencode([{
    command = [
      "node",
      "node_modules/node-pg-migrate/bin/node-pg-migrate.js",
      "up",
      "--migrations-dir",
      "dist/migrations",
      "--database-url-var",
      "DATABASE_URL",
    ]
    essential = true
    image     = var.container_image
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.application.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "migration"
      }
    }
    name                   = "migration"
    readonlyRootFilesystem = true
    secrets = [{
      name      = "DATABASE_URL"
      valueFrom = aws_secretsmanager_secret.runtime["DATABASE_URL"].arn
    }]
  }])
  cpu                      = "512"
  execution_role_arn       = aws_iam_role.ecs_execution["migration"].arn
  family                   = "${local.name}-migration"
  memory                   = "1024"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  task_role_arn            = aws_iam_role.migration.arn

  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }

  lifecycle { ignore_changes = [container_definitions] }
}

resource "aws_ecs_service" "api" {
  cluster                            = aws_ecs_cluster.main.id
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100
  desired_count                      = var.api_desired_count
  enable_execute_command             = false
  force_new_deployment               = false
  health_check_grace_period_seconds  = var.api_certificate_arn == null ? null : 60
  launch_type                        = "FARGATE"
  name                               = "${local.name}-api"
  platform_version                   = "LATEST"
  propagate_tags                     = "SERVICE"
  task_definition                    = aws_ecs_task_definition.api.arn
  wait_for_steady_state              = true

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  dynamic "load_balancer" {
    for_each = var.api_certificate_arn == null ? [] : [var.api_certificate_arn]

    content {
      container_name   = "api"
      container_port   = 3000
      target_group_arn = aws_lb_target_group.api.arn
    }
  }

  network_configuration {
    assign_public_ip = true
    security_groups  = [aws_security_group.api.id]
    subnets          = aws_subnet.public[*].id
  }

  lifecycle { ignore_changes = [desired_count, task_definition] }

  depends_on = [aws_lb_listener.https]
}

resource "aws_ecs_service" "worker" {
  cluster                            = aws_ecs_cluster.main.id
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100
  desired_count                      = var.worker_desired_count
  enable_execute_command             = false
  launch_type                        = "FARGATE"
  name                               = "${local.name}-worker"
  platform_version                   = "LATEST"
  propagate_tags                     = "SERVICE"
  task_definition                    = aws_ecs_task_definition.worker.arn
  wait_for_steady_state              = true

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    assign_public_ip = true
    security_groups  = [aws_security_group.worker.id]
    subnets          = aws_subnet.public[*].id
  }

  lifecycle { ignore_changes = [desired_count, task_definition] }
}
