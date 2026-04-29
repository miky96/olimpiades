/**
 * Cloud Functions per a Olimpiades.
 *
 * `syncUserClaims` manté els custom claims de Firebase Auth (`role`, `status`)
 * sincronitzats amb el document `/users/{uid}` de Firestore. Així les Security
 * Rules poden llegir el rol directament del token (`request.auth.token.role`)
 * en lloc de fer un `get()` extra a cada regla, estalviant lectures i latència.
 *
 * Comportament:
 *  - onCreate / onUpdate del doc d'usuari → setCustomUserClaims({ role, status }).
 *  - onDelete del doc d'usuari → buida les claims (setCustomUserClaims(null)).
 *  - Idempotent: si role i status no han canviat, no toca res.
 *  - Si l'usuari no existeix encara a Auth, ho registra i surt sense fallar
 *    (la doc s'haurà creat abans de l'auth user; el següent canvi reactivarà
 *    la sincronització).
 *
 * Nota sobre propagació: l'ID token actual del client només es refresca
 * automàticament cada ~1h. Si cal aplicar el canvi immediatament, el client
 * ha de cridar `user.getIdToken(true)`.
 */

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";

initializeApp();

type Role = "admin" | "superadmin";
type UserStatus = "active" | "blocked";

interface UserDoc {
  role?: Role;
  status?: UserStatus;
}

interface UserClaims {
  role: Role;
  status: UserStatus;
}

/**
 * Trigger v2: es dispara a qualsevol create/update/delete de /users/{uid}.
 * Desplegat a `europe-west1` per estar a la mateixa multi-regió que la base
 * de dades Firestore (`eur3`). Així el trigger d'Eventarc no fa salts
 * transatlàntics i evitem mal comportament del provisioning cross-region.
 */
export const syncUserClaims = onDocumentWritten(
  { document: "users/{uid}", region: "europe-west1" },
  async (event) => {
    const uid = event.params.uid;
    const after = event.data?.after.data() as UserDoc | undefined;
    const before = event.data?.before.data() as UserDoc | undefined;

    // Cas 1: el document s'ha eliminat → netejem les claims.
    if (!after) {
      await clearClaims(uid);
      return;
    }

    const role = after.role;
    const status = after.status ?? "active";

    if (!isValidRole(role)) {
      logger.warn("syncUserClaims: rol invàlid o absent", { uid, role });
      await clearClaims(uid);
      return;
    }

    // Idempotència: si role i status no han canviat respecte before, sortim.
    if (before && before.role === role && (before.status ?? "active") === status) {
      logger.debug("syncUserClaims: sense canvis rellevants", { uid });
      return;
    }

    const claims: UserClaims = { role, status };
    await applyClaims(uid, claims);
  }
);

function isValidRole(role: unknown): role is Role {
  return role === "admin" || role === "superadmin";
}

async function applyClaims(uid: string, claims: UserClaims): Promise<void> {
  try {
    await getAuth().setCustomUserClaims(uid, claims);
    logger.info("syncUserClaims: claims aplicats", { uid, claims });
  } catch (err) {
    if (isUserNotFound(err)) {
      logger.warn(
        "syncUserClaims: usuari Auth inexistent, s'ignora (es reaplicarà al següent canvi)",
        { uid }
      );
      return;
    }
    throw err;
  }
}

async function clearClaims(uid: string): Promise<void> {
  try {
    await getAuth().setCustomUserClaims(uid, null);
    logger.info("syncUserClaims: claims netejats", { uid });
  } catch (err) {
    if (isUserNotFound(err)) {
      return;
    }
    throw err;
  }
}

function isUserNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "auth/user-not-found"
  );
}
