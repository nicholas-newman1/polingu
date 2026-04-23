output "kill_switch_function_name" {
  description = "Name of the kill-switch Cloud Function."
  value       = google_cloudfunctions2_function.kill_switch.name
}

output "billing_alerts_topic" {
  description = "Pub/Sub topic that receives budget alerts."
  value       = google_pubsub_topic.billing_alerts.name
}

output "kill_switch_service_account" {
  description = "Service account used by the kill-switch function."
  value       = google_service_account.kill_switch.email
}

output "monthly_budget_cad" {
  description = "Configured monthly budget cap."
  value       = var.monthly_budget_cad
}
