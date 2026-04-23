resource "google_secret_manager_secret" "openai_api_key" {
  project   = var.project_id
  secret_id = "OPENAI_API_KEY"

  replication {
    auto {}
  }

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [labels, topics]
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "deepl_api_key" {
  project   = var.project_id
  secret_id = "DEEPL_API_KEY"

  replication {
    auto {}
  }

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [labels, topics]
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_iam_member" "openai_accessor" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.openai_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.functions_runtime_sa}"
}

resource "google_secret_manager_secret_iam_member" "deepl_accessor" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.deepl_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.functions_runtime_sa}"
}
