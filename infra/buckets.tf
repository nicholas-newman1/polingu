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

# The audio_cache bucket is intentionally public-read: it hosts shared TTS
# audio (sentences, vocabulary, declension, conjugation, verb-infinitives)
# that is fetched by every signed-in user and benefits from edge caching.
# Per-user audio lives in the default bucket under audio/users/{userId}/...
# and is governed by storage.rules instead.
resource "google_storage_bucket_iam_member" "audio_cache_public_read" {
  bucket = google_storage_bucket.audio_cache.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
