import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { OlimpiadaEvent } from "@/domain/types";
import { paths } from "./collections";

function fromDoc(id: string, data: Record<string, unknown>): OlimpiadaEvent {
  return {
    id,
    seasonId: data.seasonId as string,
    date: data.date as string,
    sport: data.sport as string,
    format: data.format as OlimpiadaEvent["format"],
    status: data.status as OlimpiadaEvent["status"],
    config: (data.config as OlimpiadaEvent["config"]) ?? {},
  };
}

export const eventsRepo = {
  async list(seasonId: string): Promise<OlimpiadaEvent[]> {
    const q = query(
      collection(getDb(), paths.events(seasonId)),
      orderBy("date", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
  },

  async get(seasonId: string, eventId: string): Promise<OlimpiadaEvent | null> {
    const snap = await getDoc(doc(getDb(), paths.event(seasonId, eventId)));
    return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
  },

  async create(
    seasonId: string,
    event: Omit<OlimpiadaEvent, "id" | "seasonId">
  ): Promise<string> {
    const ref = await addDoc(collection(getDb(), paths.events(seasonId)), {
      seasonId,
      ...event,
    });
    return ref.id;
  },

  async update(
    seasonId: string,
    eventId: string,
    patch: Partial<Omit<OlimpiadaEvent, "id" | "seasonId">>
  ): Promise<void> {
    await updateDoc(doc(getDb(), paths.event(seasonId, eventId)), patch);
  },
};
