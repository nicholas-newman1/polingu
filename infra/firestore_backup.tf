resource "google_service_account" "firestore_backup" {
  project      = var.project_id
  account_id   = "firestore-backup-fn"
  display_name = "Firestore backup function"
  description  = "Runs weekly to export Firestore to Cloud Storage."

  depends_on = [google_project_service.apis]
}

resource "google_project_iam_member" "firestore_backup_export" {
  project = var.project_id
  role    = "roles/datastore.importExportAdmin"
  member  = "serviceAccount:${google_service_account.firestore_backup.email}"
}

resource "google_project_iam_member" "firestore_backup_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.firestore_backup.email}"
}

resource "google_storage_bucket_iam_member" "firestore_backup_bucket_admin" {
  bucket = google_storage_bucket.firestore_backups.name
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.firestore_backup.email}"
}

resource "google_storage_bucket" "firestore_backup_src" {
  name                        = "${var.project_id}-firestore-backup-src"
  project                     = var.project_id
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true

  versioning {
    enabled = true
  }

  depends_on = [google_project_service.apis]
}

data "archive_file" "firestore_backup_zip" {
  type        = "zip"
  source_dir  = "${path.module}/firestore-backup-function"
  output_path = "${path.module}/.build/firestore-backup-function.zip"
  excludes    = ["node_modules", ".build", "package-lock.json"]
}

resource "google_storage_bucket_object" "firestore_backup_src" {
  name   = "firestore-backup-${data.archive_file.firestore_backup_zip.output_md5}.zip"
  bucket = google_storage_bucket.firestore_backup_src.name
  source = data.archive_file.firestore_backup_zip.output_path
}

resource "google_cloudfunctions2_function" "firestore_backup" {
  project  = var.project_id
  name     = "firestore-backup"
  location = var.region

  build_config {
    runtime     = "nodejs20"
    entry_point = "scheduledFirestoreBackup"

    source {
      storage_source {
        bucket = google_storage_bucket.firestore_backup_src.name
        object = google_storage_bucket_object.firestore_backup_src.name
      }
    }
  }

  service_config {
    max_instance_count             = 1
    min_instance_count             = 0
    available_memory               = "256M"
    timeout_seconds                = 540
    service_account_email          = google_service_account.firestore_backup.email
    ingress_settings               = "ALLOW_INTERNAL_ONLY"
    all_traffic_on_latest_revision = true

    environment_variables = {
      GCP_PROJECT   = var.project_id
      BACKUP_BUCKET = google_storage_bucket.firestore_backups.name
    }
  }

  depends_on = [
    google_project_iam_member.firestore_backup_export,
    google_project_iam_member.firestore_backup_logging,
    google_storage_bucket_iam_member.firestore_backup_bucket_admin,
  ]
}

resource "google_cloud_scheduler_job" "firestore_backup" {
  project     = var.project_id
  region      = var.region
  name        = "weekly-firestore-backup"
  description = "Triggers weekly Firestore export to Cloud Storage"
  schedule    = "0 3 * * 0"
  time_zone   = "America/Toronto"

  http_target {
    http_method = "POST"
    uri         = google_cloudfunctions2_function.firestore_backup.service_config[0].uri

    oidc_token {
      service_account_email = google_service_account.firestore_backup.email
    }
  }

  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_service_iam_member" "firestore_backup_invoker" {
  project  = var.project_id
  location = var.region
  service  = google_cloudfunctions2_function.firestore_backup.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.firestore_backup.email}"
}
