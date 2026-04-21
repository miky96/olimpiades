import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { AttendanceRecord } from "@/domain/types";
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
};
