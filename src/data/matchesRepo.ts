import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Match } from "@/domain/types";
import { paths } from "./collections";

function fromDoc(id: string, data: Record<string, unknown>): Match {
  return {
    id,
    eventId: data.eventId as string,
    phase: data.phase as Match["phase"],
    groupId: data.groupId as string | undefined,
    round: data.round as number | undefined,
    teamAId: (data.teamAId as string) ?? null,
    teamBId: (data.teamBId as string) ?? null,
    winnerTeamId: (data.winnerTeamId as string) ?? null,
    scoreA: data.scoreA as number | undefined,
    scoreB: data.scoreB as number | undefined,
  };
}

export const matchesRepo = {
  async list(seasonId: string, eventId: string): Promise<Match[]> {
    const snap = await getDocs(
      collection(getDb(), paths.matches(seasonId, eventId))
    );
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
  },

  /** Escriu molts matches en una sola transacció (útil per inicialitzar la competició). */
  async bulkCreate(
    seasonId: string,
    eventId: string,
    matches: Match[]
  ): Promise<void> {
    const db = getDb();
    const batch = writeBatch(db);
    for (const m of matches) {
      const ref = doc(db, paths.match(seasonId, eventId, m.id));
      batch.set(ref, {
        eventId: m.eventId,
        phase: m.phase,
        groupId: m.groupId ?? null,
        round: m.round ?? null,
        teamAId: m.teamAId,
        teamBId: m.teamBId,
        winnerTeamId: m.winnerTeamId,
        scoreA: m.scoreA ?? null,
        scoreB: m.scoreB ?? null,
      });
    }
    await batch.commit();
  },

  async setResult(
    seasonId: string,
    eventId: string,
    matchId: string,
    result: { winnerTeamId: string | null; scoreA?: number; scoreB?: number }
  ): Promise<void> {
    await updateDoc(doc(getDb(), paths.match(seasonId, eventId, matchId)), result);
  },

  async remove(seasonId: string, eventId: string, matchId: string): Promise<void> {
    await deleteDoc(doc(getDb(), paths.match(seasonId, eventId, matchId)));
  },

  /** Elimina tots els matches d'un esdeveniment. */
  async clearAll(seasonId: string, eventId: string): Promise<void> {
    const snap = await getDocs(collection(getDb(), paths.matches(seasonId, eventId)));
    const db = getDb();
    const batch = writeBatch(db);
    for (const d of snap.docs) {
      batch.delete(d.ref);
    }
    await batch.commit();
  },

  async upsert(seasonId: string, eventId: string, match: Match): Promise<void> {
    await setDoc(doc(getDb(), paths.match(seasonId, eventId, match.id)), {
      eventId: match.eventId,
      phase: match.phase,
      groupId: match.groupId ?? null,
      round: match.round ?? null,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      winnerTeamId: match.winnerTeamId,
      scoreA: match.scoreA ?? null,
      scoreB: match.scoreB ?? null,
    });
  },
};
