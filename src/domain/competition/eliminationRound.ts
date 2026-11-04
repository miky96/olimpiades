/**
 * Ajuda per omplir una ronda "per posicions" d'un joc eliminatori.
 *
 * En lloc d'escriure posicions a mà, l'admin va marcant qui queda eliminat:
 * el primer eliminat queda últim, el següent penúltim... i l'últim que
 * queda viu és el primer. Si n'eliminen diversos alhora, comparteixen la
 * millor de les posicions que ocupen (esquema 1, 2, 2, 4).
 *
 * Tot l'estat es deriva de `round.scores` (no hi ha estat extra a
 * Firestore): un participant que juga i no té posició és "viu".
 */

import type { PointsRound } from "../types";
import { isValidPlacement } from "./pointsLeague";

export interface EliminationState {
  /** Participants que juguen i encara no tenen posició. */
  alive: string[];
  /** Participants amb posició, de millor a pitjor. */
  eliminated: { teamId: string; position: number }[];
}

export function getEliminationState(
  round: PointsRound,
  playingTeamIds: string[]
): EliminationState {
  const alive: string[] = [];
  const eliminated: EliminationState["eliminated"] = [];
  for (const teamId of playingTeamIds) {
    const pos = round.scores[teamId];
    if (pos != null && isValidPlacement(pos)) {
      eliminated.push({ teamId, position: pos });
    } else {
      alive.push(teamId);
    }
  }
  eliminated.sort((a, b) => a.position - b.position);
  return { alive, eliminated };
}

/** Posició que rebran els `count` participants eliminats ara. */
export function positionForElimination(
  state: EliminationState,
  count: number
): number {
  return state.alive.length - count + 1;
}

/**
 * Escriptures (teamId → posició) per eliminar `teamIds` alhora. Si després
 * només en queda un de viu, també se li assigna la 1a posició.
 */
export function planElimination(
  state: EliminationState,
  teamIds: string[]
): Record<string, number> {
  const unique = [...new Set(teamIds)];
  if (unique.length === 0) return {};
  const aliveSet = new Set(state.alive);
  if (unique.some((id) => !aliveSet.has(id))) {
    throw new Error("Només es poden eliminar participants que segueixen en joc.");
  }
  const position = positionForElimination(state, unique.length);
  const writes: Record<string, number> = {};
  for (const id of unique) writes[id] = position;
  const remaining = state.alive.filter((id) => !unique.includes(id));
  if (remaining.length === 1) writes[remaining[0]] = 1;
  return writes;
}

/** Si només en queda un de viu, el declara guanyador. */
export function planDeclareWinner(
  state: EliminationState
): Record<string, number> {
  return state.alive.length === 1 ? { [state.alive[0]]: 1 } : {};
}

/**
 * Participants a "ressuscitar" per desfer l'últim pas: els que tenen la
 * millor posició assignada (l'últim grup eliminat, o el guanyador).
 */
export function planUndo(state: EliminationState): string[] {
  if (state.eliminated.length === 0) return [];
  const best = state.eliminated[0].position;
  return state.eliminated
    .filter((e) => e.position === best)
    .map((e) => e.teamId);
}
