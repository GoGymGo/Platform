resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "${local.name}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name}-internet" }
}

resource "aws_subnet" "public" {
  count = 2

  availability_zone       = local.availability_zones[count.index]
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  map_public_ip_on_launch = false
  vpc_id                  = aws_vpc.main.id

  tags = { Name = "${local.name}-public-${count.index + 1}" }
}

resource "aws_subnet" "database" {
  count = 2

  availability_zone       = local.availability_zones[count.index]
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  map_public_ip_on_launch = false
  vpc_id                  = aws_vpc.main.id

  tags = { Name = "${local.name}-database-${count.index + 1}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${local.name}-public" }
}

resource "aws_route_table_association" "public" {
  count = 2

  route_table_id = aws_route_table.public.id
  subnet_id      = aws_subnet.public[count.index].id
}

resource "aws_security_group" "load_balancer" {
  description = "Public TLS ingress to the GoGymGo API load balancer"
  name        = "${local.name}-load-balancer"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "api" {
  description = "GoGymGo API task; ingress is restricted to the load balancer"
  name        = "${local.name}-api"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "worker" {
  description = "GoGymGo worker task with no inbound access"
  name        = "${local.name}-worker"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "migration" {
  description = "One-shot database migration tasks with no inbound access"
  name        = "${local.name}-migration"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "database" {
  description = "Private PostgreSQL access from GoGymGo runtime roles only"
  name        = "${local.name}-database"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "load_balancer_https" {
  cidr_ipv4         = "0.0.0.0/0"
  description       = "HTTPS from the internet"
  from_port         = 443
  ip_protocol       = "tcp"
  security_group_id = aws_security_group.load_balancer.id
  to_port           = 443
}

resource "aws_vpc_security_group_egress_rule" "load_balancer_api" {
  description                  = "API target health and requests"
  from_port                    = 3000
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.api.id
  security_group_id            = aws_security_group.load_balancer.id
  to_port                      = 3000
}

resource "aws_vpc_security_group_ingress_rule" "api_load_balancer" {
  description                  = "API requests from the load balancer"
  from_port                    = 3000
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.load_balancer.id
  security_group_id            = aws_security_group.api.id
  to_port                      = 3000
}

# Application dependencies use rotating public endpoints, so this rule cannot
# be narrowed to stable CIDRs. Protocol and port remain HTTPS-only.
#trivy:ignore:AVD-AWS-0104
resource "aws_vpc_security_group_egress_rule" "runtime_https" {
  for_each = {
    api       = aws_security_group.api.id
    migration = aws_security_group.migration.id
    worker    = aws_security_group.worker.id
  }

  cidr_ipv4         = "0.0.0.0/0"
  description       = "HTTPS to AWS APIs and approved external providers"
  from_port         = 443
  ip_protocol       = "tcp"
  security_group_id = each.value
  to_port           = 443
}

resource "aws_vpc_security_group_egress_rule" "runtime_dns_udp" {
  for_each = {
    api       = aws_security_group.api.id
    migration = aws_security_group.migration.id
    worker    = aws_security_group.worker.id
  }

  cidr_ipv4         = "${cidrhost(var.vpc_cidr, 2)}/32"
  description       = "DNS through the VPC resolver"
  from_port         = 53
  ip_protocol       = "udp"
  security_group_id = each.value
  to_port           = 53
}

resource "aws_vpc_security_group_egress_rule" "runtime_dns_tcp" {
  for_each = {
    api       = aws_security_group.api.id
    migration = aws_security_group.migration.id
    worker    = aws_security_group.worker.id
  }

  cidr_ipv4         = "${cidrhost(var.vpc_cidr, 2)}/32"
  description       = "DNS fallback through the VPC resolver"
  from_port         = 53
  ip_protocol       = "tcp"
  security_group_id = each.value
  to_port           = 53
}

resource "aws_vpc_security_group_egress_rule" "api_database" {
  description                  = "PostgreSQL to the private database"
  from_port                    = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.database.id
  security_group_id            = aws_security_group.api.id
  to_port                      = 5432
}

resource "aws_vpc_security_group_egress_rule" "worker_database" {
  description                  = "PostgreSQL to the private database"
  from_port                    = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.database.id
  security_group_id            = aws_security_group.worker.id
  to_port                      = 5432
}

resource "aws_vpc_security_group_egress_rule" "migration_database" {
  description                  = "PostgreSQL to the private database"
  from_port                    = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.database.id
  security_group_id            = aws_security_group.migration.id
  to_port                      = 5432
}

resource "aws_vpc_security_group_ingress_rule" "database_api" {
  description                  = "PostgreSQL from API tasks"
  from_port                    = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.api.id
  security_group_id            = aws_security_group.database.id
  to_port                      = 5432
}

resource "aws_vpc_security_group_ingress_rule" "database_worker" {
  description                  = "PostgreSQL from worker tasks"
  from_port                    = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.worker.id
  security_group_id            = aws_security_group.database.id
  to_port                      = 5432
}

resource "aws_vpc_security_group_ingress_rule" "database_migration" {
  description                  = "PostgreSQL from migration tasks"
  from_port                    = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.migration.id
  security_group_id            = aws_security_group.database.id
  to_port                      = 5432
}
