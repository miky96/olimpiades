import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc, writeBatch, } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { paths } from "./collections";
function fromDoc(id, data) {
    return {
        id,
        eventId: data.eventId,
        phase: data.phase,
        groupId: data.groupId,
        round: data.round,
        teamAId: data.teamAId ?? null,
        teamBId: data.teamBId ?? null,
        winnerTeamId: data.winnerTeamId ?? null,
        scoreA: data.scoreA,
        scoreB: data.scoreB,
    };
}
export const matchesRepo = {
    async list(seasonId, eventId) {
        const snap = await getDocs(collection(getDb(), paths.matches(seasonId, eventId)));
        return snap.docs.map((d) => fromDoc(d.id, d.data()));
    },
    /** Escriu molts matches en una sola transacció (útil per inicialitzar la competició). */
    async bulkCreate(seasonId, eventId, matches) {
        const db = getDb();
        const batch = writeBatch(db);
        for (const m of matches) {
            const ref = doc(db, paths.match(seasonId, eventId, m.id));
            batch.set(ref, {
                eventId: m.eventId,
                phase: m.phase,
                groupId: m.groupId ?? null,
                round: m.round ?? null,
                teamAId: m.teamAId,
                teamBId: m.teamBId,
                winnerTeamId: m.winnerTeamId,
                scoreA: m.scoreA ?? null,
                scoreB: m.scoreB ?? null,
            });
        }
        await batch.commit();
    },
    async setResult(seasonId, eventId, matchId, result) {
        await updateDoc(doc(getDb(), paths.match(seasonId, eventId, matchId)), result);
    },
    async remove(seasonId, eventId, matchId) {
        await deleteDoc(doc(getDb(), paths.match(seasonId, eventId, matchId)));
    },
    /** Elimina tots els matches d'un esdeveniment. */
    async clearAll(seasonId, eventId) {
        const snap = await getDocs(collection(getDb(), paths.matches(seasonId, eventId)));
        const db = getDb();
        const batch = writeBatch(db);
        for (const d of snap.docs) {
            batch.delete(d.ref);
        }
        await batch.commit();
    },
    async upsert(seasonId, eventId, match) {
        await setDoc(doc(getDb(), paths.match(seasonId, eventId, match.id)), {
            eventId: match.eventId,
            phase: match.phase,
            groupId: match.groupId ?? null,
            round: match.round ?? null,
            teamAId: match.teamAId,
            teamBId: match.teamBId,
            winnerTeamId: match.winnerTeamId,
            scoreA: match.scoreA ?? null,
            scoreB: match.scoreB ?? null,
        });
    },
};
