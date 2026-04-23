resource "google_firestore_database" "default" {
  project                     = var.project_id
  name                        = "(default)"
  location_id                 = "nam5"
  type                        = "FIRESTORE_NATIVE"
  concurrency_mode            = "PESSIMISTIC"
  app_engine_integration_mode = "DISABLED"

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      location_id,
      type,
    ]
  }

  depends_on = [google_project_service.apis]
}
