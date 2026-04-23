import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { AttendanceRecord, Participant } from "@/domain/types";
import { computeMissingAttendanceDefaults } from "@/domain/attendance";
import { paths } from "./collections";

function fromDoc(id: string, data: Record<string, unknown>): AttendanceRecord {
  return {
    id,
    eventId: data.eventId as string,
    participantId: data.participantId as string,
    status: data.status as AttendanceRecord["status"],
    bonusPoints: (data.bonusPoints as number) ?? 0,
    penaltyPoints: (data.penaltyPoints as number) ?? 0,
    comment: data.comment as string | undefined,
  };
}

export const attendanceRepo = {
  async listForEvent(
    seasonId: string,
    eventId: string
  ): Promise<AttendanceRecord[]> {
    const snap = await getDocs(
      collection(getDb(), paths.attendance(seasonId, eventId))
    );
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
  },

  /**
   * Guardem l'assistència usant el participantId com a ID del document.
   * Així cada participant només pot tenir una assistència per esdeveniment.
   */
  async upsert(
    seasonId: string,
    eventId: string,
    record: Omit<AttendanceRecord, "id" | "eventId">
  ): Promise<void> {
    await setDoc(
      doc(getDb(), paths.attendanceRecord(seasonId, eventId, record.participantId)),
      {
        eventId,
        ...record,
      }
    );
  },

  /**
   * Persisteix registres d'assistència per defecte (Present · +5) per a tots
   * els participants elegibles que encara no en tinguin. La lògica d'elegibilitat
   * i dels valors per defecte viu al mòdul de domini
   * (`computeMissingAttendanceDefaults`); aquí només orquestrem la persistència.
   *
   * Casos d'ús: garantir un estat consistent abans de finalitzar un esdeveniment
   * (la UI mostra els defaults, però si l'admin no edita res no es desa res i
   * el càlcul de punts quedaria desajustat). Reutilitzable per altres fluxos
   * futurs (p. ex. "marcar tothom com a present" manual).
   *
   * Retorna la llista completa d'assistència (existent + nous per defecte).
   */
  async ensureDefaults(
    seasonId: string,
    eventId: string,
    params: { participants: Participant[]; existing: AttendanceRecord[] }
  ): Promise<AttendanceRecord[]> {
    const { participants, existing } = params;
    const missing = computeMissingAttendanceDefaults({
      eventId,
      participants,
      existing,
    });
    if (missing.length === 0) return existing;
    await Promise.all(
      missing.map((r) =>
        attendanceRepo.upsert(seasonId, eventId, {
          participantId: r.participantId,
          status: r.status,
          bonusPoints: r.bonusPoints,
          penaltyPoints: r.penaltyPoints,
        })
      )
    );
    return [...existing, ...missing];
  },
};
