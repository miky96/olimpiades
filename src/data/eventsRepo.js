import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, updateDoc, } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { paths } from "./collections";
function fromDoc(id, data) {
    return {
        id,
        seasonId: data.seasonId,
        date: data.date,
        sport: data.sport,
        format: data.format,
        status: data.status,
        config: data.config ?? {},
        name: data.name,
        finalStandings: data.finalStandings,
        pointsBreakdown: data.pointsBreakdown,
    };
}
export const eventsRepo = {
    async list(seasonId) {
        const q = query(collection(getDb(), paths.events(seasonId)), orderBy("date", "desc"));
        const snap = await getDocs(q);
        return snap.docs.map((d) => fromDoc(d.id, d.data()));
    },
    async get(seasonId, eventId) {
        const snap = await getDoc(doc(getDb(), paths.event(seasonId, eventId)));
        return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
    },
    async create(seasonId, event) {
        const ref = await addDoc(collection(getDb(), paths.events(seasonId)), {
            seasonId,
            ...event,
        });
        return ref.id;
    },
    async update(seasonId, eventId, patch) {
        await updateDoc(doc(getDb(), paths.event(seasonId, eventId)), patch);
    },
    async remove(seasonId, eventId) {
        await deleteDoc(doc(getDb(), paths.event(seasonId, eventId)));
    },
};
