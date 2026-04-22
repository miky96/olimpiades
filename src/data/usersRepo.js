import { collection, doc, getDoc, getDocs, setDoc, updateDoc, } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { paths } from "./collections";
function fromDoc(id, data) {
    return {
        uid: id,
        email: data.email,
        role: data.role,
        status: data.status ?? "active",
    };
}
/**
 * Gestió de usuaris admin/superadmin.
 * El rol real s'ha de reflectir també com a custom claim a Firebase Auth
 * (aquesta part es fa amb una Cloud Function en fase 2; a l'MVP ho mantenim
 * només a Firestore i ho validem amb Security Rules).
 */
export const usersRepo = {
    async list() {
        const snap = await getDocs(collection(getDb(), paths.users()));
        return snap.docs.map((d) => fromDoc(d.id, d.data()));
    },
    async get(uid) {
        const snap = await getDoc(doc(getDb(), paths.user(uid)));
        return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
    },
    /** Crea o actualitza l'entrada d'usuari (normalment cridada pel superadmin). */
    async upsert(user) {
        await setDoc(doc(getDb(), paths.user(user.uid)), {
            email: user.email,
            role: user.role,
            status: user.status,
        });
    },
    async block(uid) {
        await updateDoc(doc(getDb(), paths.user(uid)), { status: "blocked" });
    },
    async unblock(uid) {
        await updateDoc(doc(getDb(), paths.user(uid)), { status: "active" });
    },
};
