resource "google_storage_bucket" "firebase_default" {
  name     = var.firebase_storage_bucket
  project  = var.project_id
  location = "US"

  uniform_bucket_level_access = false

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      location,
      storage_class,
      cors,
      lifecycle_rule,
      labels,
    ]
  }

  depends_on = [google_project_service.apis]
}

resource "google_storage_bucket" "audio_cache" {
  name     = var.audio_cache_bucket
  project  = var.project_id
  location = "US"

  uniform_bucket_level_access = true

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      location,
      storage_class,
      cors,
      lifecycle_rule,
      labels,
    ]
  }

  depends_on = [google_project_service.apis]
}
