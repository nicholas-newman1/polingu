locals {
  project_number       = data.google_project.this.number
  functions_runtime_sa = coalesce(var.functions_runtime_sa, "${local.project_number}-compute@developer.gserviceaccount.com")
}

resource "google_project_service" "apis" {
  for_each = toset([
    "cloudresourcemanager.googleapis.com",
    "cloudbilling.googleapis.com",
    "billingbudgets.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "secretmanager.googleapis.com",
    "pubsub.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "run.googleapis.com",
    "eventarc.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "firestore.googleapis.com",
    "firebase.googleapis.com",
    "firebasestorage.googleapis.com",
    "storage.googleapis.com",
    "cloudtasks.googleapis.com",
    "texttospeech.googleapis.com",
    "cloudscheduler.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}
