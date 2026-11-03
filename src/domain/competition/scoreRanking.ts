/**
 * Format `score_ranking`: una sola prova (p. ex. cursa d'orientació) on cada
 * competidor (participant individual o equip) obté una puntuació. La
 * classificació d'aquesta prova és directament la classificació final de
 * l'esdeveniment (i per tant determina els punts 5/3/1).
 *
 * Persistència: reaprofitem `PointsRound` amb una única ronda (roundNumber 1)
 * i el mapa `scores: teamId -> puntuació`.
 *
 * Mòdul pur: no depèn de Firebase.
 */

import type { FinalStanding, PointsRound, Team } from "../types";
import { assignDensePositions } from "../positions";

/** "desc": guanya qui té més punts. "asc": guanya qui en té menys (p. ex. temps). */
export type ScoreOrder = "desc" | "asc";

export const DEFAULT_SCORE_ORDER: ScoreOrder = "desc";

export const scoreOrderLabels: Record<ScoreOrder, string> = {
  desc: "Guanya qui té més punts",
  asc: "Guanya qui té menys punts (p. ex. temps)",
};

export interface ScoreRankingRow {
  teamId: string;
  /** `null` si encara no s'ha introduït la puntuació. */
  score: number | null;
  /** Posició (empats densos) o `null` si no té puntuació. */
  position: number | null;
}

/** Retorna l'única ronda de puntuació (la de roundNumber més baix), si n'hi ha. */
export function getSingleScoreRound(
  rounds: PointsRound[]
): PointsRound | undefined {
  if (rounds.length === 0) return undefined;
  return [...rounds].sort((a, b) => a.roundNumber - b.roundNumber)[0];
}

function scoreOf(
  scores: Record<string, number>,
  teamId: string
): number | null {
  const v = scores[teamId];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Classificació final: només hi entren els competidors amb puntuació.
 * Els que no en tenen no reben posició (equivalent a no haver puntuat).
 */
export function computeScoreRankingStandings(
  teams: Team[],
  scores: Record<string, number>,
  order: ScoreOrder = DEFAULT_SCORE_ORDER
): FinalStanding[] {
  const sign = order === "asc" ? -1 : 1;
  const inputs = teams
    .map((t) => ({ teamId: t.id, score: scoreOf(scores, t.id) }))
    .filter((e): e is { teamId: string; score: number } => e.score !== null)
    .map((e) => ({ teamId: e.teamId, score: sign * e.score }));
  return assignDensePositions(inputs);
}

/**
 * Files per a la UI: primer els competidors amb puntuació (per posició),
 * després els que encara no en tenen (en l'ordre original dels equips).
 */
export function rankScoreRows(
  teams: Team[],
  scores: Record<string, number>,
  order: ScoreOrder = DEFAULT_SCORE_ORDER
): ScoreRankingRow[] {
  const standings = computeScoreRankingStandings(teams, scores, order);
  const positionByTeam = new Map<string, number>();
  const orderIdx = new Map<string, number>();
  let i = 0;
  for (const s of standings) {
    for (const tid of s.teamIds) {
      positionByTeam.set(tid, s.position);
      orderIdx.set(tid, i++);
    }
  }
  const scored: ScoreRankingRow[] = [];
  const unscored: ScoreRankingRow[] = [];
  for (const t of teams) {
    const position = positionByTeam.get(t.id) ?? null;
    const row = { teamId: t.id, score: scoreOf(scores, t.id), position };
    if (position === null) unscored.push(row);
    else scored.push(row);
  }
  scored.sort(
    (a, b) => (orderIdx.get(a.teamId) ?? 0) - (orderIdx.get(b.teamId) ?? 0)
  );
  return [...scored, ...unscored];
}

/** Competidors que encara no tenen puntuació. */
export function teamsWithoutScore(
  teams: Team[],
  scores: Record<string, number>
): string[] {
  return teams.filter((t) => scoreOf(scores, t.id) === null).map((t) => t.id);
}
