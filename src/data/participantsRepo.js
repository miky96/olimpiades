import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc, } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { paths } from "./collections";
function fromDoc(id, data) {
    return {
        id,
        seasonId: data.seasonId,
        name: data.name,
        active: data.active ?? true,
    };
}
export const participantsRepo = {
    async list(seasonId) {
        const snap = await getDocs(collection(getDb(), paths.participants(seasonId)));
        return snap.docs.map((d) => fromDoc(d.id, d.data()));
    },
    async create(seasonId, participant) {
        const ref = await addDoc(collection(getDb(), paths.participants(seasonId)), {
            seasonId,
            ...participant,
        });
        return ref.id;
    },
    async update(seasonId, participantId, patch) {
        await updateDoc(doc(getDb(), paths.participant(seasonId, participantId)), patch);
    },
    async remove(seasonId, participantId) {
        await deleteDoc(doc(getDb(), paths.participant(seasonId, participantId)));
    },
};
