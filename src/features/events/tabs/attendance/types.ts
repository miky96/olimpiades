import type { AttendanceStatus, Participant } from "@/domain/types";

/**
 * Estat editable d'un participant a la pestanya d'assistència.
 *
 * Un `Row` viu sempre en memòria de la UI; només es desa a Firestore quan
 * `dirty` és `true` i l'usuari prem "Desa".
 */
export interface AttendanceRow {
  participant: Participant;
  status: AttendanceStatus;
  bonusPoints: number;
  penaltyPoints: number;
  comment: string;
  /** True si l'usuari ha tocat aquest registre i encara no s'ha desat. */
  dirty: boolean;
}

/**
 * Ordre canònic d'estats per a llistats i seccions agrupades.
 * Mantingut com a constant compartida perquè evolucioni en un sol lloc.
 */
export const STATUS_ORDER: AttendanceStatus[] = [
  "present",
  "late",
  "absent_notified",
  "absent_unnotified",
];

export const STATUS_TONES: Record<
  AttendanceStatus,
  "emerald" | "amber" | "slate" | "rose"
> = {
  present: "emerald",
  late: "amber",
  absent_notified: "slate",
  absent_unnotified: "rose",
};
