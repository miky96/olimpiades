# Backups de Firestore

Aquest projecte fa un export diari de la base de dades Firestore a un bucket de
Google Cloud Storage. Tot està dimensionat per mantenir-se dins de la free tier
de GCP (cost esperat: 0 €).

## Què es fa exactament

- Cada dia a les **03:00 UTC** un Cloud Scheduler job dispara
  `firestore.exportDocuments` cap al bucket
  `gs://olimpiades-b1576-firestore-backups/`.
- Cada export queda en una carpeta amb timestamp dins del bucket.
- Els exports de més de **30 dies** s'esborren automàticament (lifecycle rule).

## Per què surt 0 €

| Component | Free tier rellevant | Consum esperat per a l'MVP |
|-----------|---------------------|----------------------------|
| Cloud Scheduler | 3 jobs/mes gratuïts | 1 job |
| Cloud Storage (`us-central1`) | 5 GB/mes "always free" | < 50 MB |
| Firestore reads (export) | 50.000 reads/dia | <<5.000 a curt/mig termini |

L'únic risc real és que el volum de Firestore creixi molt: si superem ~40k
documents totals, l'export diari començaria a consumir reads útils per l'app.
En aquest cas, opcions: passar a setmanal, o exportar només col·leccions
crítiques.

## Setup únic

Es fa un sol cop, des d'una màquina amb `gcloud` autenticat amb un usuari amb
rol Owner o Editor sobre el projecte `olimpiades-b1576`.

```bash
cd scripts/backups
chmod +x setup-firestore-backups.sh
./setup-firestore-backups.sh
```

> **Sobre múltiples projectes a gcloud**: aquest script **no** fa
> `gcloud config set project`, així que no toca el teu projecte default.
> Tots els comandos passen `--project=olimpiades-b1576` explícit. A més, abans
> de fer res mostra el compte i el projecte de destí i et demana que escriguis
> el `PROJECT_ID` exacte com a confirmació. Si t'equivoques, es queda avortat
> sense haver creat res.

L'script és **idempotent**: pots tornar-lo a executar si canvies retencions o
horari (variables d'entorn `RETENTION_DAYS`, `SCHEDULE_CRON`,
`SCHEDULE_TIMEZONE`).

Variables sobreescriptibles:

| Variable | Default | Significat |
|----------|---------|------------|
| `PROJECT_ID` | `olimpiades-b1576` | Projecte GCP |
| `REGION` | `us-central1` | Cal mantenir `us-central1`, `us-east1` o `us-west1` per la free tier de GCS |
| `BUCKET_NAME` | `${PROJECT_ID}-firestore-backups` | Nom del bucket |
| `RETENTION_DAYS` | `30` | Dies abans d'esborrar dumps automàticament |
| `SCHEDULE_CRON` | `0 3 * * *` | Cron del job (UTC) |
| `SCHEDULE_TIMEZONE` | `Etc/UTC` | Zona horària del cron |

## Verificar que va

Forçar un backup manual:

```bash
gcloud scheduler jobs run firestore-daily-backup \
  --location=us-central1 \
  --project=olimpiades-b1576
```

Llistar backups existents:

```bash
gsutil ls gs://olimpiades-b1576-firestore-backups/
```

Veure les últimes operacions de Firestore (status, errors, durada):

```bash
gcloud firestore operations list --project=olimpiades-b1576 --limit=5
```

## Restaurar

Hi ha un script `restore-firestore.sh` que automatitza el cas habitual:

```bash
# 1. Llistar backups disponibles
./scripts/backups/restore-firestore.sh

# 2. Restaurar-ne un (cal escriure "RESTORE" per confirmar)
./scripts/backups/restore-firestore.sh 2026-04-27T03:00:00_12345
```

**Important sobre el restore:**

- L'import *sobreescriu* els documents amb el mateix path però **no esborra**
  els que ja existeixen al destí. Si vols un restore "net", el camí més segur
  és restaurar contra un projecte de proves nou abans de tocar producció.
- Mai facis un restore directament a producció sense haver verificat el dump
  contra un entorn d'staging primer.

## Què passa quan ja no en tinguem prou

Senyals per replantejar la solució:

- El consum de reads de l'export comença a notar-se a la quota diària.
- Vols recuperar a un punt arbitrari del dia, no només a la nit (PITR).
- Necessites historial > 90 dies.

Quan arribi alguna d'aquestes, considera la **Managed Backup / PITR** nativa de
Firestore (té cost de storage propi, ~0,03 €/GiB-mes, però és més robusta i
permet point-in-time recovery dins d'una finestra de 7 dies).
