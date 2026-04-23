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
 * Regla d'elegibilitat (la mateixa que la UI d'assistència):
 *  - Participants actius a la temporada.
 *  - Més els que ja tenen un registre previ, encara que siguin inactius
 *    (per contemplar el cas "un inactiu va venir puntualment").
 *
 * No fa cap escriptura ni càlcul agregat: només retorna els registres que
 * falten. Els consumidors (p. ex. `attendanceRepo.ensureDefaults`) poden
 * persistir-los.
 *
 * Nota sobre `id`: el repositori de Firestore usa el `participantId` com a
 * identificador del document, així que podem avançar aquest valor sense
 * haver de consultar Firestore.
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
