/**
 * Càlcul de posicions finals d'un esdeveniment a partir dels matches.
 *
 * El model fa servir un tipus explícit `BracketTier` per classificar a quin
 * "nivell" ha arribat cada equip (campió, subcampió, 3r, 4t, o simplement
 * "ha arribat fins a la ronda N"). Això manté la lògica del càlcul
 * autodescriptiva i permet afegir nous tiers (p. ex. partit de 5è/6è)
 * sense haver de fer mans i mànigues amb constants numèriques màgiques.
 *
 * Per a l'assignació de posicions fem servir un score numèric intern
 * (`tierScore`) que només serveix per ordenar tiers; la lògica de negoci
 * treballa sempre amb tiers.
 */

import type { FinalStanding, Match } from "./types";
import { assignDensePositions } from "./positions";

/**
 * Nivell assolit per un equip a la fase eliminatòria.
 *
 * Ordre (millor -> pitjor):
 *   final_winner > final_loser > third_place_winner > third_place_loser >
 *   reached_round(r) (r més gran = millor) > none
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
 *
 * - Final (o partit únic): guanyador -> final_winner; perdedor -> final_loser.
 * - Partit de 3r: guanyador -> third_place_winner; perdedor -> third_place_loser.
 * - Altres rondes eliminatòries: si guanya, reached_round(round).
 * - Fase de grups: no compta (no afecta el tier).
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

    // Rondes eliminatòries anteriors (quarts, vuitens, etc.).
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
 */
export function areAllMatchesDecided(matches: Match[]): boolean {
  return matches.every((m) => m.winnerTeamId !== null || m.teamBId === null);
}
