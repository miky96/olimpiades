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
        createdAt: data.createdAt ?? undefined,
    };
}
function sortByCreation(teams) {
    return [...teams].sort((a, b) => {
        const ca = a.createdAt ?? 0;
        const cb = b.createdAt ?? 0;
        if (ca !== cb)
            return ca - cb;
        return a.name.localeCompare(b.name);
    });
}
export const teamsRepo = {
    async list(seasonId, eventId) {
        const snap = await getDocs(collection(getDb(), paths.teams(seasonId, eventId)));
        const teams = snap.docs.map((d) => fromDoc(d.id, d.data()));
        return sortByCreation(teams);
    },
    async create(seasonId, eventId, team) {
        const ref = await addDoc(collection(getDb(), paths.teams(seasonId, eventId)), {
            eventId,
            createdAt: Date.now(),
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
