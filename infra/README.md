# Infrastructure (Terraform)

Provisions:

- Monthly **billing budget** (`google_billing_budget`) that publishes threshold events to a **Pub/Sub topic** (`billing-alerts`).
- **Kill-switch Cloud Function v2** (`kill-switch`) that subscribes to the topic and writes a feature-flag doc at Firestore `config/killSwitch` when spend crosses 90% of the monthly cap.
- Secret Manager containers for `OPENAI_API_KEY` / `DEEPL_API_KEY` plus `secretAccessor` bindings to the functions runtime service account.
- Project API enablements.

Adopted (pre-existing, managed in place with `prevent_destroy`):

- The `(default)` Firestore database
- `polish-declension.firebasestorage.app` + `polingu-audio` storage buckets
- `OPENAI_API_KEY` + `DEEPL_API_KEY` secrets

Not managed here (stays in Firebase CLI):

- Cloud Functions source and deploys (`firebase deploy --only functions`)
- `firestore.rules`, `storage.rules`, hosting
- Cloud Tasks queues and Eventarc triggers auto-created by Firebase Functions v2

## One-time bootstrap

You need `gcloud` logged in as an Owner (or equivalent) and
`roles/billing.costsManager` on the billing account.

```bash
# 1. Log in for Application Default Credentials (Terraform reads these).
gcloud auth application-default login
gcloud config set project polish-declension

# 2. Create the Terraform state bucket (matches backend.tf prefix).
gcloud storage buckets create gs://polish-declension-tf-state \
  --project=polish-declension \
  --location=us \
  --uniform-bucket-level-access
gcloud storage buckets update gs://polish-declension-tf-state --versioning

# 3. Grab your billing account ID.
gcloud billing accounts list

# 4. Create terraform.tfvars (gitignored) with your billing_account_id.
cat > terraform.tfvars <<'EOF'
project_id         = "polish-declension"
region             = "us-central1"
billing_account_id = "XXXXXX-XXXXXX-XXXXXX"
monthly_budget_cad = 50

budget_alert_emails = [
  "you@example.com",
]
EOF
```

## Initialize and apply

```bash
cd infra
terraform init
terraform plan   # confirm no-op on adopted resources; budget / kill switch are to-create
terraform apply
```

On the very first apply, Terraform will:

- Enable required APIs (~2 minutes, idempotent)
- Create the Pub/Sub topic, budget, kill-switch bucket+function, and IAM

The Firestore DB, storage buckets, and secrets were adopted into state via
`import {}` blocks on the initial bootstrap and are now managed in place.
`lifecycle { prevent_destroy = true }` on those resources means
`terraform destroy` will refuse to drop them — intentional.

If you need to bootstrap the same stack in a brand-new project where those
resources don't exist yet, either pre-create them (Firebase console / gcloud)
or temporarily re-add matching `import {}` blocks pointing at the new IDs.

### If the Firestore location_id mismatches

`firestore.tf` declares `location_id = "nam5"`. If your Firestore is in a
different region (e.g. `us-central1`), the import will still succeed because
`lifecycle.ignore_changes` skips that field, but edit the value to match the
real one just for clarity. Check with:

```bash
gcloud firestore databases describe --database='(default)' --format='value(locationId)'
```

## Manually triggering / testing the kill switch

Publish a fake budget alert to the topic:

```bash
gcloud pubsub topics publish billing-alerts \
  --message='{"budgetDisplayName":"test","alertThresholdExceeded":0.9,"costAmount":45,"budgetAmount":50,"currencyCode":"CAD"}'
```

Then check Firestore `config/killSwitch`. Logs:

```bash
gcloud functions logs read kill-switch --region=us-central1 --limit=20
```

## Clearing the kill switch

It is intentionally manual. Either:

- Flip the fields in the Firestore console (set `translateDisabled` / `audioDisabled` / `booksDisabled` to `false`), or
- Run from an admin account:

```bash
gcloud firestore documents delete "config/killSwitch"
```

(App code fails open when the doc is missing, so deletion = fully enabled.)

## Rotating secrets

Terraform owns the secret *containers*, not the values. Rotate values out of band:

```bash
printf '%s' "sk-new-key" | gcloud secrets versions add OPENAI_API_KEY --data-file=-
printf '%s' "deepl-new-key" | gcloud secrets versions add DEEPL_API_KEY --data-file=-
```

App functions read the latest version on cold start (because of `defineSecret`),
so allow a few minutes or redeploy to force-refresh.

## Drift check

Run on a schedule (or before big releases):

```bash
terraform plan -detailed-exitcode
```

Exit code `2` means drift detected (someone clicked in the console).

## Firestore backups

The stack includes automated weekly Firestore exports:

- **Schedule**: Every Sunday at 3 AM Toronto time
- **Retention**: 28 days (4 weekly backups)
- **Destination**: `gs://polish-declension-firestore-backups/<timestamp>/`

### Manually triggering a backup

```bash
gcloud functions call firestore-backup --region=us-central1
```

Or via curl with authentication:

```bash
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "$(gcloud functions describe firestore-backup --region=us-central1 --format='value(serviceConfig.uri)')"
```

### Viewing backup status

List recent export operations:

```bash
gcloud firestore operations list --database='(default)'
```

List backups in the bucket:

```bash
gcloud storage ls gs://polish-declension-firestore-backups/
```

### Restoring from a backup

1. Pick a backup timestamp from the bucket listing above.
2. Import it (this merges with existing data; use a fresh database for full restore):

```bash
gcloud firestore import gs://polish-declension-firestore-backups/<timestamp>/
```

**Warning**: Import overwrites documents with the same IDs. For a clean restore,
delete the target collections first or restore to a different database.

## What to do when the budget fires

1. Check billing dashboard to see what collection/service spiked.
2. Check functions logs for abuse patterns.
3. Rotate OpenAI/DeepL keys if you suspect leak.
4. Once the issue is contained, clear `config/killSwitch` (see above).
5. If the budget itself was too low, bump `monthly_budget_cad` in `terraform.tfvars` and `terraform apply`.
