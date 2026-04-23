resource "google_service_account" "kill_switch" {
  project      = var.project_id
  account_id   = "kill-switch-fn"
  display_name = "Kill switch function"
  description  = "Runs when a billing budget threshold fires; writes the Firestore kill-switch doc."

  depends_on = [google_project_service.apis]
}

resource "google_project_iam_member" "kill_switch_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.kill_switch.email}"
}

resource "google_project_iam_member" "kill_switch_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.kill_switch.email}"
}

resource "google_storage_bucket" "kill_switch_src" {
  name                        = "${var.project_id}-kill-switch-src"
  project                     = var.project_id
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true

  versioning {
    enabled = true
  }

  depends_on = [google_project_service.apis]
}

data "archive_file" "kill_switch_zip" {
  type        = "zip"
  source_dir  = "${path.module}/kill-switch-function"
  output_path = "${path.module}/.build/kill-switch-function.zip"
  excludes    = ["node_modules", ".build", "package-lock.json"]
}

resource "google_storage_bucket_object" "kill_switch_src" {
  name   = "kill-switch-${data.archive_file.kill_switch_zip.output_md5}.zip"
  bucket = google_storage_bucket.kill_switch_src.name
  source = data.archive_file.kill_switch_zip.output_path
}

resource "google_cloudfunctions2_function" "kill_switch" {
  project  = var.project_id
  name     = "kill-switch"
  location = var.region

  build_config {
    runtime     = "nodejs20"
    entry_point = "handleBudgetAlert"

    source {
      storage_source {
        bucket = google_storage_bucket.kill_switch_src.name
        object = google_storage_bucket_object.kill_switch_src.name
      }
    }
  }

  service_config {
    max_instance_count             = 3
    min_instance_count             = 0
    available_memory               = "256M"
    timeout_seconds                = 60
    service_account_email          = google_service_account.kill_switch.email
    ingress_settings               = "ALLOW_INTERNAL_ONLY"
    all_traffic_on_latest_revision = true
  }

  event_trigger {
    trigger_region = var.region
    event_type     = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic   = google_pubsub_topic.billing_alerts.id
    retry_policy   = "RETRY_POLICY_RETRY"
  }

  depends_on = [
    google_project_iam_member.kill_switch_firestore,
    google_project_iam_member.kill_switch_logging,
  ]
}
