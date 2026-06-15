/**
 * Càlcul de posicions finals d'un esdeveniment a partir dels matches.
 *
 */

import type { FinalStanding, Match } from "./types";
import { assignDensePositions } from "./positions";

/**
 * Nivell assolit per un equip a la fase eliminatòria.
 *
 */
export type BracketTier =
  | { kind: "none" }
  | { kind: "reached_round"; round: number }
  | { kind: "third_place_loser" }
  | { kind: "third_place_winner" }
  | { kind: "final_loser" }
  | { kind: "final_winner" };

// Base numèrica per als tiers "especials". Prou gran per garantir que sempre
// queden per sobre de qualsevol `round` realista (log2(N) amb N <= 64 => r <= 6).
const TIER_BASE = 1_000;

const TIER_SCORE = {
  final_winner: TIER_BASE + 4,
  final_loser: TIER_BASE + 3,
  third_place_winner: TIER_BASE + 2,
  third_place_loser: TIER_BASE + 1,
} as const;

/**
 * Converteix un tier a un score numèric per a l'ordenació.
 * Implementació interna: no forma part del contracte públic del mòdul.
 */
function tierScore(tier: BracketTier): number {
  switch (tier.kind) {
    case "none":
      return 0;
    case "reached_round":
      return tier.round;
    case "third_place_loser":
      return TIER_SCORE.third_place_loser;
    case "third_place_winner":
      return TIER_SCORE.third_place_winner;
    case "final_loser":
      return TIER_SCORE.final_loser;
    case "final_winner":
      return TIER_SCORE.final_winner;
  }
}

/**
 * Determina el millor tier assolit per un equip donat l'historial de matches.
 */
export function computeBracketTier(teamId: string, matches: Match[]): BracketTier {
  let best: BracketTier = { kind: "none" };

  const consider = (candidate: BracketTier) => {
    if (tierScore(candidate) > tierScore(best)) {
      best = candidate;
    }
  };

  for (const m of matches) {
    if (m.phase === "group") continue;

    const participated = m.teamAId === teamId || m.teamBId === teamId;
    const won = m.winnerTeamId === teamId;

    if (m.phase === "final" || m.phase === "single") {
      if (won) consider({ kind: "final_winner" });
      else if (participated && m.winnerTeamId != null) consider({ kind: "final_loser" });
      continue;
    }

    if (m.phase === "third_place") {
      if (won) consider({ kind: "third_place_winner" });
      else if (participated && m.winnerTeamId != null) consider({ kind: "third_place_loser" });
      continue;
    }

    if (won) consider({ kind: "reached_round", round: m.round ?? 0 });
  }

  return best;
}

/**
 * Retorna les posicions finals per a una llista d'equips i els seus matches.
 * Equips sense victòries a fase eliminatòria queden tots empatats a la darrera posició.
 */
export function computeFinalStandings(
  teamIds: string[],
  matches: Match[]
): FinalStanding[] {
  const inputs = teamIds.map((teamId) => ({
    teamId,
    score: tierScore(computeBracketTier(teamId, matches)),
  }));
  return assignDensePositions(inputs);
}

/**
 * Comprova si tots els matches "jugables" tenen guanyador.
 * Un match és jugable si té els dos equips assignats (teamBId != null).
 * Els byes (teamBId = null) ja tenen winner prefixat.
 *
 * Per a empats explícits a fase de grups (winnerTeamId = null amb scoreA == scoreB)
 * també considerem el match com a "decidit", ja que la classificació ja queda
 * determinada (cada equip suma 1 punt).
 */
export function areAllMatchesDecided(matches: Match[]): boolean {
  return matches.every(
    (m) =>
      m.winnerTeamId !== null ||
      m.teamBId === null ||
      (m.phase === "group" &&
        m.scoreA != null &&
        m.scoreB != null &&
        m.scoreA === m.scoreB)
  );
}

/**
 * Posicions finals per al format "Només lligueta".
 *
 */
export function computeLeagueFinalStandings(
  teamIds: string[],
  matches: Match[]
): FinalStanding[] {
  const points = new Map<string, number>(teamIds.map((id) => [id, 0]));
  for (const m of matches) {
    if (m.phase !== "group") continue;
    if (!m.teamAId || !m.teamBId) continue;
    if (m.winnerTeamId === m.teamAId) {
      points.set(m.teamAId, (points.get(m.teamAId) ?? 0) + 3);
    } else if (m.winnerTeamId === m.teamBId) {
      points.set(m.teamBId, (points.get(m.teamBId) ?? 0) + 3);
    } else if (
      m.winnerTeamId === null &&
      m.scoreA != null &&
      m.scoreB != null &&
      m.scoreA === m.scoreB
    ) {
      points.set(m.teamAId, (points.get(m.teamAId) ?? 0) + 1);
      points.set(m.teamBId, (points.get(m.teamBId) ?? 0) + 1);
    }
  }
  const inputs = teamIds.map((teamId) => ({
    teamId,
    score: points.get(teamId) ?? 0,
  }));
  return assignDensePositions(inputs);
}
