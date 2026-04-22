/**
 * Valors per defecte de bonus i penalització segons l'estat d'assistència.
 * L'admin pot sobreescriure'ls per cas concret a la UI.
 *
 * Aquests valors reflecteixen les regles base (veure docs/decisions.md):
 *  - Assistir → bonus +5
 *  - Arribar tard → +5 de bonus però -1 de penalització (exemple)
 *  - Absent avisant → 0 / 0 (no penalitzat)
 *  - Absent sense avisar → 0 / -3
 */

import type { AttendanceStatus } from "./types";

export interface AttendanceDefaults {
  bonusPoints: number;
  penaltyPoints: number;
}

export const defaultsByStatus: Record<AttendanceStatus, AttendanceDefaults> = {
  present: { bonusPoints: 5, penaltyPoints: 0 },
  late: { bonusPoints: 5, penaltyPoints: -1 },
  absent_notified: { bonusPoints: 0, penaltyPoints: 0 },
  absent_unnotified: { bonusPoints: 0, penaltyPoints: -3 },
};

export function defaultsFor(status: AttendanceStatus): AttendanceDefaults {
  return defaultsByStatus[status];
}

/** Etiquetes humanes per a la UI. */
export const attendanceLabels: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Arriba tard",
  absent_notified: "Absent (avisat)",
  absent_unnotified: "Absent (sense avisar)",
};
