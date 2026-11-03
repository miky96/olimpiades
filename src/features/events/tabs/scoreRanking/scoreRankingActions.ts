/**
 * Side-effects del format `score_ranking`. La lògica de classificació viu
 * a `@/domain/competition/scoreRanking`; aquí només persistim.
 */

import { pointsRoundsRepo } from "@/data";
import type { PointsRound } from "@/domain/types";

/** Id fix de l'única ronda: evita duplicats si es fan dues escriptures seguides. */
export const SCORE_RANKING_ROUND_ID = "single";

/**
 * Desa (o esborra, si `value` és null) la puntuació d'un competidor. Crea
 * la ronda única si encara no existeix.
 */
export async function saveScoreRankingScore(params: {
  seasonId: string;
  eventId: string;
  round: PointsRound | undefined;
  teamId: string;
  value: number | null;
}): Promise<void> {
  const { seasonId, eventId, round, teamId, value } = params;
  if (!round) {
    if (value === null) return;
    await pointsRoundsRepo.upsert(seasonId, eventId, {
      id: SCORE_RANKING_ROUND_ID,
      eventId,
      roundNumber: 1,
      scores: { [teamId]: value },
    });
    return;
  }
  if (value === null) {
    await pointsRoundsRepo.clearScore(seasonId, eventId, round.id, teamId);
  } else {
    await pointsRoundsRepo.setScore(seasonId, eventId, round.id, teamId, value);
  }
}
