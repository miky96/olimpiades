import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where, } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { paths } from "./collections";
function fromDoc(id, data) {
    return {
        id,
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status,
    };
}
export const seasonsRepo = {
    async list() {
        const snap = await getDocs(collection(getDb(), paths.seasons()));
        return snap.docs.map((d) => fromDoc(d.id, d.data()));
    },
    async getActive() {
        const q = query(collection(getDb(), paths.seasons()), where("status", "==", "active"));
        const snap = await getDocs(q);
        if (snap.empty)
            return null;
        const d = snap.docs[0];
        return fromDoc(d.id, d.data());
    },
    async get(id) {
        const snap = await getDoc(doc(getDb(), paths.season(id)));
        return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
    },
    async create(season) {
        const ref = await addDoc(collection(getDb(), paths.seasons()), season);
        return ref.id;
    },
    async archive(id, endDate) {
        await updateDoc(doc(getDb(), paths.season(id)), {
            status: "archived",
            endDate,
        });
    },
};
