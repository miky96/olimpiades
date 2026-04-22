import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { paths } from "./collections";
function fromDoc(id, data) {
    return {
        id,
        eventId: data.eventId,
        participantId: data.participantId,
        status: data.status,
        bonusPoints: data.bonusPoints ?? 0,
        penaltyPoints: data.penaltyPoints ?? 0,
        comment: data.comment,
    };
}
export const attendanceRepo = {
    async listForEvent(seasonId, eventId) {
        const snap = await getDocs(collection(getDb(), paths.attendance(seasonId, eventId)));
        return snap.docs.map((d) => fromDoc(d.id, d.data()));
    },
    /**
     * Guardem l'assistència usant el participantId com a ID del document.
     * Així cada participant només pot tenir una assistència per esdeveniment.
     */
    async upsert(seasonId, eventId, record) {
        await setDoc(doc(getDb(), paths.attendanceRecord(seasonId, eventId, record.participantId)), {
            eventId,
            ...record,
        });
    },
};
