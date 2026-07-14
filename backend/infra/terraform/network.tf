resource "google_compute_network" "backend" {
  project                 = var.project_id
  name                    = "${local.name}-network"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"

  depends_on = [google_project_service.required]
}

resource "google_compute_subnetwork" "run" {
  project                  = var.project_id
  name                     = "${local.name}-run"
  ip_cidr_range            = var.run_subnet_cidr
  region                   = var.region
  network                  = google_compute_network.backend.id
  private_ip_google_access = true
}

resource "google_compute_global_address" "private_services" {
  project       = var.project_id
  name          = "${local.name}-private-services"
  address_type  = "INTERNAL"
  purpose       = "VPC_PEERING"
  prefix_length = var.private_service_prefix_length
  network       = google_compute_network.backend.id
}

resource "google_service_networking_connection" "private_services" {
  network                 = google_compute_network.backend.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]

  depends_on = [google_project_service.required]
}
