import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Season } from "@/domain/types";
import { paths } from "./collections";

function fromDoc(id: string, data: Record<string, unknown>): Season {
  return {
    id,
    name: data.name as string,
    startDate: data.startDate as string,
    endDate: data.endDate as string | undefined,
    status: data.status as Season["status"],
  };
}

export const seasonsRepo = {
  async list(): Promise<Season[]> {
    const snap = await getDocs(collection(getDb(), paths.seasons()));
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
  },

  async getActive(): Promise<Season | null> {
    const q = query(
      collection(getDb(), paths.seasons()),
      where("status", "==", "active")
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return fromDoc(d.id, d.data());
  },

  async get(id: string): Promise<Season | null> {
    const snap = await getDoc(doc(getDb(), paths.season(id)));
    return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
  },

  async create(season: Omit<Season, "id">): Promise<string> {
    const ref = await addDoc(collection(getDb(), paths.seasons()), season);
    return ref.id;
  },

  async archive(id: string, endDate: string): Promise<void> {
    await updateDoc(doc(getDb(), paths.season(id)), {
      status: "archived",
      endDate,
    });
  },
};
