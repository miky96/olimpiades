#!/usr/bin/env bash
#
# Restaura un backup concret de Firestore.
#
# ATENCIO: per defecte, importar un backup *no* esborra els documents
# existents, pero sobreescriu els que tenen el mateix path. Si vols un
# restore "net", fes-ho contra un projecte nou o esborra primer les
# col-leccions afectades.
#
# Aquest script NO toca `gcloud config set project`. Tot va via --project.
#
# Us:
#   ./restore-firestore.sh                       # llista els backups
#   ./restore-firestore.sh <timestamp>           # restaura un backup concret

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-olimpiades-b1576}"
BUCKET_NAME="${BUCKET_NAME:-${PROJECT_ID}-firestore-backups}"

ACTIVE_ACCOUNT="$(gcloud config get-value account 2>/dev/null || echo 'cap-compte')"
echo "Compte gcloud actiu: ${ACTIVE_ACCOUNT}"
echo "Projecte de DESTI:   ${PROJECT_ID}"
echo ""

if [ "$#" -lt 1 ]; then
  echo "Backups disponibles a gs://${BUCKET_NAME}:"
  gsutil ls "gs://${BUCKET_NAME}/" || true
  echo ""
  echo "Per restaurar-ne un:"
  echo "  $0 <prefix>      # ex: 2026-04-27T03:00:00_12345"
  exit 0
fi

PREFIX="$1"
INPUT_URI="gs://${BUCKET_NAME}/${PREFIX}"

echo ">>> Restaurarem des de: ${INPUT_URI}"
echo ">>> Cap al projecte:    ${PROJECT_ID}"
read -r -p "Confirma escrivint 'RESTORE ${PROJECT_ID}': " CONFIRM
if [ "${CONFIRM}" != "RESTORE ${PROJECT_ID}" ]; then
  echo "Avortat."
  exit 1
fi

gcloud firestore import "${INPUT_URI}" --project="${PROJECT_ID}" --quiet

echo ">>> Import iniciat. Pots seguir-ne l'estat amb:"
echo "      gcloud firestore operations list --project=${PROJECT_ID}"
