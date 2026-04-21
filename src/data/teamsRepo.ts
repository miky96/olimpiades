import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Team } from "@/domain/types";
import { paths } from "./collections";

function fromDoc(id: string, data: Record<string, unknown>): Team {
  return {
    id,
    eventId: data.eventId as string,
    name: data.name as string,
    participantIds: (data.participantIds as string[]) ?? [],
  };
}

export const teamsRepo = {
  async list(seasonId: string, eventId: string): Promise<Team[]> {
    const snap = await getDocs(collection(getDb(), paths.teams(seasonId, eventId)));
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
  },

  async create(
    seasonId: string,
    eventId: string,
    team: Omit<Team, "id" | "eventId">
  ): Promise<string> {
    const ref = await addDoc(collection(getDb(), paths.teams(seasonId, eventId)), {
      eventId,
      ...team,
    });
    return ref.id;
  },

  async update(
    seasonId: string,
    eventId: string,
    teamId: string,
    patch: Partial<Omit<Team, "id" | "eventId">>
  ): Promise<void> {
    await updateDoc(doc(getDb(), paths.team(seasonId, eventId, teamId)), patch);
  },

  async remove(seasonId: string, eventId: string, teamId: string): Promise<void> {
    await deleteDoc(doc(getDb(), paths.team(seasonId, eventId, teamId)));
  },
};
