resource "google_pubsub_topic" "billing_alerts" {
  project = var.project_id
  name    = "billing-alerts"

  depends_on = [google_project_service.apis]
}

resource "google_billing_budget" "monthly_cap" {
  billing_account = var.billing_account_id
  display_name    = "polingu monthly cap"

  budget_filter {
    projects               = ["projects/${local.project_number}"]
    credit_types_treatment = "INCLUDE_ALL_CREDITS"
    calendar_period        = "MONTH"
  }

  amount {
    specified_amount {
      currency_code = "CAD"
      units         = tostring(floor(var.monthly_budget_cad))
    }
  }

  threshold_rules {
    threshold_percent = 0.5
    spend_basis       = "CURRENT_SPEND"
  }
  threshold_rules {
    threshold_percent = 0.9
    spend_basis       = "CURRENT_SPEND"
  }
  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "CURRENT_SPEND"
  }
  threshold_rules {
    threshold_percent = 1.2
    spend_basis       = "CURRENT_SPEND"
  }

  all_updates_rule {
    pubsub_topic                     = google_pubsub_topic.billing_alerts.id
    schema_version                   = "1.0"
    monitoring_notification_channels = google_monitoring_notification_channel.email[*].id
    disable_default_iam_recipients   = false
  }

  depends_on = [google_project_service.apis]
}

resource "google_monitoring_notification_channel" "email" {
  count = length(var.budget_alert_emails)

  project      = var.project_id
  display_name = "Budget alert email ${count.index}"
  type         = "email"

  labels = {
    email_address = var.budget_alert_emails[count.index]
  }

  depends_on = [google_project_service.apis]
}
