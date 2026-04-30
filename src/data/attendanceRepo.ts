import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
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
   * Persisteix múltiples assistències en una sola operació atòmica.
   * Pensat per fluxos de marcatge massiu (p. ex. "Marca aquests 30 com a present"):
   * un únic round-trip a Firestore i, si falla, no queden estats parcials.
   *
   * Si la llista és buida no fa cap escriptura.
   */
  async upsertMany(
    seasonId: string,
    eventId: string,
    records: Omit<AttendanceRecord, "id" | "eventId">[]
  ): Promise<void> {
    if (records.length === 0) return;
    const db = getDb();
    const batch = writeBatch(db);
    for (const r of records) {
      const ref = doc(
        db,
        paths.attendanceRecord(seasonId, eventId, r.participantId)
      );
      const payload: Record<string, unknown> = {
        eventId,
        participantId: r.participantId,
        status: r.status,
        bonusPoints: r.bonusPoints,
        penaltyPoints: r.penaltyPoints,
      };
      if (r.comment && r.comment.trim().length > 0) {
        payload.comment = r.comment.trim();
      }
      batch.set(ref, payload);
    }
    await batch.commit();
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
    // Atòmic: si fallés a meitat, no quedarien defaults parcialment persistits
    // que l'usuari no ha pogut veure ni editar.
    const db = getDb();
    const batch = writeBatch(db);
    for (const r of missing) {
      const ref = doc(
        db,
        paths.attendanceRecord(seasonId, eventId, r.participantId)
      );
      batch.set(ref, {
        eventId,
        participantId: r.participantId,
        status: r.status,
        bonusPoints: r.bonusPoints,
        penaltyPoints: r.penaltyPoints,
      });
    }
    await batch.commit();
    return [...existing, ...missing];
  },
};
