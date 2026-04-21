import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { AppUser } from "@/domain/types";
import { paths } from "./collections";

function fromDoc(id: string, data: Record<string, unknown>): AppUser {
  return {
    uid: id,
    email: data.email as string,
    role: data.role as AppUser["role"],
    status: (data.status as AppUser["status"]) ?? "active",
  };
}

/**
 * Gestió de usuaris admin/superadmin.
 * El rol real s'ha de reflectir també com a custom claim a Firebase Auth
 * (aquesta part es fa amb una Cloud Function en fase 2; a l'MVP ho mantenim
 * només a Firestore i ho validem amb Security Rules).
 */
export const usersRepo = {
  async list(): Promise<AppUser[]> {
    const snap = await getDocs(collection(getDb(), paths.users()));
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
  },

  async get(uid: string): Promise<AppUser | null> {
    const snap = await getDoc(doc(getDb(), paths.user(uid)));
    return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
  },

  /** Crea o actualitza l'entrada d'usuari (normalment cridada pel superadmin). */
  async upsert(user: AppUser): Promise<void> {
    await setDoc(doc(getDb(), paths.user(user.uid)), {
      email: user.email,
      role: user.role,
      status: user.status,
    });
  },

  async block(uid: string): Promise<void> {
    await updateDoc(doc(getDb(), paths.user(uid)), { status: "blocked" });
  },

  async unblock(uid: string): Promise<void> {
    await updateDoc(doc(getDb(), paths.user(uid)), { status: "active" });
  },
};
