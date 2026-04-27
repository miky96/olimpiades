#!/usr/bin/env bash
#
# Setup unic per a backups automatics de Firestore a Cloud Storage.
#
# Que fa:
#   1. Activa les APIs necessaries.
#   2. Crea un bucket GCS a us-central1 (free tier "always free": 5 GB/mes).
#   3. Aplica una lifecycle rule per esborrar dumps de mes de 30 dies.
#   4. Crea un service account amb el rol minim per exportar Firestore.
#   5. Crea una Cloud Scheduler job que dispara l'export diari a les 03:00 UTC.
#
# IMPORTANT: aquest script NO toca `gcloud config set project`. Tots els
# comandos passen --project="${PROJECT_ID}" explicit, aixi que encara que
# tinguis un altre projecte com a default a la teva consola, aqui no s'hi
# tocara absolutament res. A mes, abans de fer res mostra el context i
# demana confirmacio escrivint el PROJECT_ID exacte.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-olimpiades-b1576}"
REGION="${REGION:-us-central1}"
SCHEDULE_TIMEZONE="${SCHEDULE_TIMEZONE:-Etc/UTC}"
SCHEDULE_CRON="${SCHEDULE_CRON:-0 3 * * *}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

BUCKET_NAME="${BUCKET_NAME:-${PROJECT_ID}-firestore-backups}"
SERVICE_ACCOUNT_NAME="firestore-backup-sa"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SCHEDULER_JOB_NAME="firestore-daily-backup"
SCHEDULER_LOCATION="${SCHEDULER_LOCATION:-${REGION}}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIFECYCLE_FILE="${SCRIPT_DIR}/lifecycle.json"

# --- 0. Safety: mostra context i demana confirmacio ------------------------

ACTIVE_ACCOUNT="$(gcloud config get-value account 2>/dev/null || echo 'cap-compte')"
DEFAULT_PROJECT="$(gcloud config get-value project 2>/dev/null || echo 'cap')"

cat <<EOF
=========================================================================
  Aquest script creara recursos NOMES dins d'aquest projecte:

      Compte gcloud actiu:      ${ACTIVE_ACCOUNT}
      Projecte de DESTI:        ${PROJECT_ID}
      Projecte default actual:  ${DEFAULT_PROJECT}    (NO es tocara)
      Region (bucket + cron):   ${REGION}
      Bucket:                   gs://${BUCKET_NAME}
      Retencio:                 ${RETENTION_DAYS} dies
      Schedule:                 ${SCHEDULE_CRON} (${SCHEDULE_TIMEZONE})

  Per continuar, escriu el PROJECT_ID exacte com a confirmacio.
=========================================================================
EOF

read -r -p "Confirma escrivint '${PROJECT_ID}': " CONFIRM
if [ "${CONFIRM}" != "${PROJECT_ID}" ]; then
  echo "Avortat: la confirmacio no coincideix."
  exit 1
fi

# --- 1. Activar APIs -------------------------------------------------------

echo ">>> Activant APIs al projecte ${PROJECT_ID}..."
gcloud services enable \
  firestore.googleapis.com \
  storage.googleapis.com \
  cloudscheduler.googleapis.com \
  iam.googleapis.com \
  --project="${PROJECT_ID}" \
  --quiet

# --- 2. Bucket de backups --------------------------------------------------

if gsutil ls -b "gs://${BUCKET_NAME}" >/dev/null 2>&1; then
  echo ">>> Bucket gs://${BUCKET_NAME} ja existeix."
else
  echo ">>> Creant bucket gs://${BUCKET_NAME} a ${REGION}..."
  gsutil mb -p "${PROJECT_ID}" -l "${REGION}" -b on "gs://${BUCKET_NAME}"
fi

echo ">>> Aplicant lifecycle (${RETENTION_DAYS} dies)..."
if [ "${RETENTION_DAYS}" = "30" ]; then
  gsutil lifecycle set "${LIFECYCLE_FILE}" "gs://${BUCKET_NAME}"
else
  TMP_LIFECYCLE="$(mktemp)"
  cat > "${TMP_LIFECYCLE}" <<LCFG
{
  "lifecycle": {
    "rule": [
      { "action": { "type": "Delete" }, "condition": { "age": ${RETENTION_DAYS} } }
    ]
  }
}
LCFG
  gsutil lifecycle set "${TMP_LIFECYCLE}" "gs://${BUCKET_NAME}"
  rm -f "${TMP_LIFECYCLE}"
fi

# --- 3. Service account ----------------------------------------------------

if gcloud iam service-accounts describe "${SERVICE_ACCOUNT_EMAIL}" \
     --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo ">>> Service account ${SERVICE_ACCOUNT_EMAIL} ja existeix."
else
  echo ">>> Creant service account ${SERVICE_ACCOUNT_EMAIL}..."
  gcloud iam service-accounts create "${SERVICE_ACCOUNT_NAME}" \
    --project="${PROJECT_ID}" \
    --display-name="Firestore daily backup" \
    --description="Exporta Firestore a GCS un cop al dia" \
    --quiet
fi

echo ">>> Concedint rols minims..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/datastore.importExportAdmin" \
  --condition=None \
  --quiet >/dev/null

gsutil iam ch \
  "serviceAccount:${SERVICE_ACCOUNT_EMAIL}:objectAdmin" \
  "gs://${BUCKET_NAME}" >/dev/null

# --- 4. Cloud Scheduler job ------------------------------------------------

EXPORT_URI="https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default):exportDocuments"
EXPORT_BODY="{\"outputUriPrefix\":\"gs://${BUCKET_NAME}\"}"

if gcloud scheduler jobs describe "${SCHEDULER_JOB_NAME}" \
     --location="${SCHEDULER_LOCATION}" \
     --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo ">>> Actualitzant job ${SCHEDULER_JOB_NAME}..."
  gcloud scheduler jobs update http "${SCHEDULER_JOB_NAME}" \
    --project="${PROJECT_ID}" \
    --location="${SCHEDULER_LOCATION}" \
    --schedule="${SCHEDULE_CRON}" \
    --time-zone="${SCHEDULE_TIMEZONE}" \
    --uri="${EXPORT_URI}" \
    --http-method=POST \
    --headers="Content-Type=application/json" \
    --message-body="${EXPORT_BODY}" \
    --oauth-service-account-email="${SERVICE_ACCOUNT_EMAIL}" \
    --quiet
else
  echo ">>> Creant job ${SCHEDULER_JOB_NAME}..."
  gcloud scheduler jobs create http "${SCHEDULER_JOB_NAME}" \
    --project="${PROJECT_ID}" \
    --location="${SCHEDULER_LOCATION}" \
    --schedule="${SCHEDULE_CRON}" \
    --time-zone="${SCHEDULE_TIMEZONE}" \
    --uri="${EXPORT_URI}" \
    --http-method=POST \
    --headers="Content-Type=application/json" \
    --message-body="${EXPORT_BODY}" \
    --oauth-service-account-email="${SERVICE_ACCOUNT_EMAIL}" \
    --description="Export diari de Firestore a gs://${BUCKET_NAME}" \
    --quiet
fi

echo ""
echo ">>> Setup acabat."
echo ">>> Pots forcar un backup ara mateix amb:"
echo "      gcloud scheduler jobs run ${SCHEDULER_JOB_NAME} --location=${SCHEDULER_LOCATION} --project=${PROJECT_ID}"
echo ">>> I llistar backups amb:"
echo "      gsutil ls gs://${BUCKET_NAME}/"
