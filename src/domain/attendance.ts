/**
 * Lògica de domini al voltant de l'assistència a un esdeveniment.
 * Aquest mòdul és **pur**: no depèn de Firebase ni de cap adaptador.
 */

import { defaultsFor } from "./attendanceDefaults";
import type { AttendanceRecord, Participant } from "./types";

/**
 * Donat un conjunt de participants i els registres d'assistència existents,
 * retorna els registres que caldria crear amb valors per defecte
 * (status "present", bonus +5, penalització 0).
 *
 */
export function computeMissingAttendanceDefaults(args: {
  eventId: string;
  participants: Participant[];
  existing: AttendanceRecord[];
}): AttendanceRecord[] {
  const { eventId, participants, existing } = args;
  const existingByParticipant = new Map(
    existing.map((a) => [a.participantId, a] as const)
  );
  const eligible = participants.filter(
    (p) => p.active || existingByParticipant.has(p.id)
  );
  const missing = eligible.filter((p) => !existingByParticipant.has(p.id));
  const defaults = defaultsFor("present");
  return missing.map((p) => ({
    id: p.id,
    eventId,
    participantId: p.id,
    status: "present" as const,
    bonusPoints: defaults.bonusPoints,
    penaltyPoints: defaults.penaltyPoints,
  }));
}

/**
 * Participants que assisteixen (presents o arribats tard). S'usa quan la
 * competició ja està en marxa (p. ex. regenerar equips entre partits
 * rotatius), moment en què els que arriben tard ja hi són.
 */
export function selectAttendingParticipants(
  participants: Participant[],
  attendance: AttendanceRecord[]
): Participant[] {
  const byParticipant = new Map(
    attendance.map((a) => [a.participantId, a] as const)
  );
  return participants.filter((p) => {
    const rec = byParticipant.get(p.id);
    if (rec) return rec.status === "present" || rec.status === "late";
    return p.active;
  });
}

/** Cert si el participant està marcat com a absent (avisat o no). */
export function isMarkedAbsent(
  participantId: string,
  attendance: AttendanceRecord[]
): boolean {
  const rec = attendance.find((a) => a.participantId === participantId);
  return rec?.status === "absent_notified" || rec?.status === "absent_unnotified";
}

/**
 * Retorna els participants que compten com a "presents" a l'esdeveniment.
 *
 */
export function selectPresentParticipants(
  participants: Participant[],
  attendance: AttendanceRecord[]
): Participant[] {
  const byParticipant = new Map(
    attendance.map((a) => [a.participantId, a] as const)
  );
  return participants.filter((p) => {
    const rec = byParticipant.get(p.id);
    if (rec) return rec.status === "present";
    return p.active;
  });
}
