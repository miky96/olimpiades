import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { PointsRound } from "@/domain/types";
import { paths } from "./collections";

function fromDoc(id: string, data: Record<string, unknown>): PointsRound {
  return {
    id,
    eventId: data.eventId as string,
    roundNumber: data.roundNumber as number,
    scores: (data.scores as Record<string, number> | undefined) ?? {},
  };
}

/**
 * Repository per a les `PointsRound` del format `points_league_bracket`.
 *
 * Decisions:
 *  - Una sola fila per ronda, amb un mapa `scores` (teamId → punts). Així
 *    actualitzar la puntuació d'un participant és una sola escriptura
 *    (updateDoc amb `scores.<teamId>`).
 *  - El roundNumber es decideix a l'aplicació (calcular max + 1) per
 *    simplicitat: és una operació poc concorrent (un sol admin escriu).
 */
export const pointsRoundsRepo = {
  async list(seasonId: string, eventId: string): Promise<PointsRound[]> {
    const q = query(
      collection(getDb(), paths.pointsRounds(seasonId, eventId)),
      orderBy("roundNumber", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
  },

  /**
   * Crea (o sobreescriu) una ronda. El document.id s'autogenera fora i
   * es passa per paràmetre per facilitar testos i evitar dobles writes.
   */
  async upsert(
    seasonId: string,
    eventId: string,
    round: PointsRound
  ): Promise<void> {
    await setDoc(doc(getDb(), paths.pointsRound(seasonId, eventId, round.id)), {
      eventId: round.eventId,
      roundNumber: round.roundNumber,
      scores: round.scores ?? {},
    });
  },

  /**
   * Actualitza el score d'un participant per a una ronda concreta.
   * Useable per inputs in-line a la UI.
   */
  async setScore(
    seasonId: string,
    eventId: string,
    roundId: string,
    teamId: string,
    points: number
  ): Promise<void> {
    await updateDoc(
      doc(getDb(), paths.pointsRound(seasonId, eventId, roundId)),
      { [`scores.${teamId}`]: points }
    );
  },

  /** Desa diversos valors d'una ronda en una sola escriptura. */
  async setScores(
    seasonId: string,
    eventId: string,
    roundId: string,
    values: Record<string, number>
  ): Promise<void> {
    const update: Record<string, number> = {};
    for (const [teamId, value] of Object.entries(values)) {
      update[`scores.${teamId}`] = value;
    }
    if (Object.keys(update).length === 0) return;
    await updateDoc(
      doc(getDb(), paths.pointsRound(seasonId, eventId, roundId)),
      update
    );
  },

  /** Esborra els valors de diversos participants en una sola escriptura. */
  async clearScores(
    seasonId: string,
    eventId: string,
    roundId: string,
    teamIds: string[]
  ): Promise<void> {
    if (teamIds.length === 0) return;
    await updateDoc(
      doc(getDb(), paths.pointsRound(seasonId, eventId, roundId)),
      Object.fromEntries(teamIds.map((id) => [`scores.${id}`, deleteField()]))
    );
  },

  /** Esborra la puntuació d'un participant (queda "sense puntuar"). */
  async clearScore(
    seasonId: string,
    eventId: string,
    roundId: string,
    teamId: string
  ): Promise<void> {
    await updateDoc(
      doc(getDb(), paths.pointsRound(seasonId, eventId, roundId)),
      { [`scores.${teamId}`]: deleteField() }
    );
  },

  async remove(
    seasonId: string,
    eventId: string,
    roundId: string
  ): Promise<void> {
    await deleteDoc(doc(getDb(), paths.pointsRound(seasonId, eventId, roundId)));
  },

  /** Elimina totes les rondes d'un esdeveniment (per al reset complet). */
  async clearAll(seasonId: string, eventId: string): Promise<void> {
    const snap = await getDocs(
      collection(getDb(), paths.pointsRounds(seasonId, eventId))
    );
    const db = getDb();
    const batch = writeBatch(db);
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
  },
};
