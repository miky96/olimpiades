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
    groupId: (data.groupId as string | undefined) ?? undefined,
    createdAt: (data.createdAt as number | undefined) ?? undefined,
  };
}

/**
 * Ordena equips per ordre d'afegit (createdAt asc). Els documents antics
 * sense createdAt queden al principi, ordenats per nom com a fallback
 * estable.
 */
function sortByCreation(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => {
    const ca = a.createdAt ?? 0;
    const cb = b.createdAt ?? 0;
    if (ca !== cb) return ca - cb;
    return a.name.localeCompare(b.name);
  });
}

export const teamsRepo = {
  async list(seasonId: string, eventId: string): Promise<Team[]> {
    const snap = await getDocs(collection(getDb(), paths.teams(seasonId, eventId)));
    const teams = snap.docs.map((d) => fromDoc(d.id, d.data()));
    return sortByCreation(teams);
  },

  async create(
    seasonId: string,
    eventId: string,
    team: Omit<Team, "id" | "eventId" | "createdAt">
  ): Promise<string> {
    const ref = await addDoc(collection(getDb(), paths.teams(seasonId, eventId)), {
      eventId,
      createdAt: Date.now(),
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
