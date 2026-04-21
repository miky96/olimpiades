import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Participant } from "@/domain/types";
import { paths } from "./collections";

function fromDoc(id: string, data: Record<string, unknown>): Participant {
  return {
    id,
    seasonId: data.seasonId as string,
    name: data.name as string,
    active: (data.active as boolean) ?? true,
  };
}

export const participantsRepo = {
  async list(seasonId: string): Promise<Participant[]> {
    const snap = await getDocs(collection(getDb(), paths.participants(seasonId)));
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
  },

  async create(
    seasonId: string,
    participant: Omit<Participant, "id" | "seasonId">
  ): Promise<string> {
    const ref = await addDoc(collection(getDb(), paths.participants(seasonId)), {
      seasonId,
      ...participant,
    });
    return ref.id;
  },

  async update(
    seasonId: string,
    participantId: string,
    patch: Partial<Omit<Participant, "id" | "seasonId">>
  ): Promise<void> {
    await updateDoc(
      doc(getDb(), paths.participant(seasonId, participantId)),
      patch
    );
  },

  async remove(seasonId: string, participantId: string): Promise<void> {
    await deleteDoc(doc(getDb(), paths.participant(seasonId, participantId)));
  },
};
