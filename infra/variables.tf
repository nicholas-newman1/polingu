variable "project_id" {
  description = "GCP project ID."
  type        = string
  default     = "polish-declension"
}

variable "region" {
  description = "Default region for regional resources (must match where Firebase Functions run)."
  type        = string
  default     = "us-central1"
}

variable "billing_account_id" {
  description = "Billing account ID in the form XXXXXX-XXXXXX-XXXXXX (from `gcloud billing accounts list`)."
  type        = string
}

variable "monthly_budget_cad" {
  description = "Monthly spend cap in CAD. Feature flags flip at 90% of this amount."
  type        = number
  default     = 50
}

variable "budget_alert_emails" {
  description = "Email addresses to CC on budget alert notifications (in addition to project billing admins)."
  type        = list(string)
  default     = []
}

variable "firebase_storage_bucket" {
  description = "Default Firebase storage bucket name (the one holding pending/final audio + books)."
  type        = string
  default     = "polish-declension.firebasestorage.app"
}

variable "audio_cache_bucket" {
  description = "Bucket used by synthesizeAndUploadAudio for TTS caching."
  type        = string
  default     = "polingu-audio"
}

variable "functions_runtime_sa" {
  description = "Email of the service account that app Cloud Functions run as (usually the default compute SA)."
  type        = string
  default     = null
}
