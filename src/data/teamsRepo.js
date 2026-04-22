import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc, } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { paths } from "./collections";
function fromDoc(id, data) {
    return {
        id,
        eventId: data.eventId,
        name: data.name,
        participantIds: data.participantIds ?? [],
        groupId: data.groupId ?? undefined,
    };
}
export const teamsRepo = {
    async list(seasonId, eventId) {
        const snap = await getDocs(collection(getDb(), paths.teams(seasonId, eventId)));
        return snap.docs.map((d) => fromDoc(d.id, d.data()));
    },
    async create(seasonId, eventId, team) {
        const ref = await addDoc(collection(getDb(), paths.teams(seasonId, eventId)), {
            eventId,
            ...team,
        });
        return ref.id;
    },
    async update(seasonId, eventId, teamId, patch) {
        await updateDoc(doc(getDb(), paths.team(seasonId, eventId, teamId)), patch);
    },
    async remove(seasonId, eventId, teamId) {
        await deleteDoc(doc(getDb(), paths.team(seasonId, eventId, teamId)));
    },
};
