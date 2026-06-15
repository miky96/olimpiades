/**
 * Format "partits rotatius" (individual): 2 equips juguen un partit. Després
 * pots afegir-ne un altre, opcionalment regenerant els equips entre rondes.
 *
 */

import type {
  IndividualFinalStanding,
  Match,
  Team,
} from "../types";
import { assignDensePositions } from "../positions";

/** Punts individuals per resultat de partit. */
export const ROTATING_WIN_POINTS = 3;
export const ROTATING_LOSS_POINTS = 0;

/**
 * Genera el partit inicial (round = 1) per al format `rotating_singles`.
 * Llença error si no hi ha exactament 2 equips.
 */
export function generateInitialRotatingMatch(
  teamIds: string[],
  opts: { eventId: string; makeId?: () => string }
): Match[] {
  return [createRotatingMatch(teamIds, { ...opts, round: 1 })];
}

/**
 * Crea un partit rotatiu en una ronda concreta.
 * Llença error si no es passen exactament 2 equips.
 */
export function createRotatingMatch(
  teamIds: string[],
  opts: { eventId: string; round: number; makeId?: () => string }
): Match {
  const {
    eventId,
    round,
    makeId = () =>
      `match_${round}_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 6)}`,
  } = opts;
  if (teamIds.length !== 2) {
    throw new Error(
      "El format 'partits rotatius' requereix exactament 2 equips."
    );
  }
  if (!Number.isInteger(round) || round < 1) {
    throw new Error("La ronda ha de ser un enter >= 1.");
  }
  return {
    id: makeId(),
    eventId,
    phase: "rotating",
    round,
    teamAId: teamIds[0],
    teamBId: teamIds[1],
    winnerTeamId: null,
  };
}

/** Retorna la ronda més alta vista entre els matches rotatius (0 si cap). */
export function lastRotatingRound(matches: Match[]): number {
  let max = 0;
  for (const m of matches) {
    if (m.phase !== "rotating") continue;
    if ((m.round ?? 0) > max) max = m.round ?? 0;
  }
  return max;
}

/** Retorna els matches rotatius ordenats per ronda ascendent. */
export function listRotatingMatches(matches: Match[]): Match[] {
  return matches
    .filter((m) => m.phase === "rotating")
    .slice()
    .sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
}

/**
 * Indica si tots els partits rotatius han estat resolts (tenen guanyador).
 * Si no n'hi ha cap, retorna true (vacuosament).
 */
export function areAllRotatingMatchesDecided(matches: Match[]): boolean {
  const rotating = matches.filter((m) => m.phase === "rotating");
  return rotating.every((m) => m.winnerTeamId !== null);
}

/**
 * Estadístiques individuals d'un participant en aquest format.
 */
export interface RotatingParticipantStats {
  participantId: string;
  played: number;
  won: number;
  lost: number;
  matchPoints: number;
}

/**
 * Calcula les estadístiques individuals (partits jugats, guanyats, perduts,
 * i punts de partit) per cada participant que ha jugat algun match rotatiu.
 *
 * Si un participant és a l'equip A i l'equip A guanya un partit, suma 1
 * partit jugat + 1 guanyat + ROTATING_WIN_POINTS. Igual amb l'equip B.
 */
export function computeRotatingStats(
  matches: Match[],
  teams: Team[]
): RotatingParticipantStats[] {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const stats = new Map<string, RotatingParticipantStats>();

  function ensure(participantId: string): RotatingParticipantStats {
    let s = stats.get(participantId);
    if (!s) {
      s = {
        participantId,
        played: 0,
        won: 0,
        lost: 0,
        matchPoints: 0,
      };
      stats.set(participantId, s);
    }
    return s;
  }

  for (const m of matches) {
    if (m.phase !== "rotating") continue;
    if (!m.teamAId || !m.teamBId) continue;
    if (!m.winnerTeamId) continue;

    const teamA = teamById.get(m.teamAId);
    const teamB = teamById.get(m.teamBId);
    if (!teamA || !teamB) continue;

    const winnerIsA = m.winnerTeamId === m.teamAId;
    const winnerIsB = m.winnerTeamId === m.teamBId;

    for (const pid of teamA.participantIds) {
      const s = ensure(pid);
      s.played += 1;
      if (winnerIsA) {
        s.won += 1;
        s.matchPoints += ROTATING_WIN_POINTS;
      } else if (winnerIsB) {
        s.lost += 1;
        s.matchPoints += ROTATING_LOSS_POINTS;
      }
    }
    for (const pid of teamB.participantIds) {
      const s = ensure(pid);
      s.played += 1;
      if (winnerIsB) {
        s.won += 1;
        s.matchPoints += ROTATING_WIN_POINTS;
      } else if (winnerIsA) {
        s.lost += 1;
        s.matchPoints += ROTATING_LOSS_POINTS;
      }
    }
  }

  return [...stats.values()];
}

/**
 * Calcula la classificació individual final per a un format rotatiu.
 *
 * Ordena per `matchPoints` descendent i resol empats amb posicions denses
 * (1, 1, 2, 3, 3, ...). Els participants empatats a punts comparteixen
 * posició.
 *
 * Inclou només els participants amb `played > 0`. Els participants apuntats
 * però que no han jugat cap partit no apareixen al rànquing (el seu bonus
 * d'assistència igualment se'ls aplicarà al càlcul de punts de l'event).
 */
export function computeRotatingIndividualStandings(
  matches: Match[],
  teams: Team[]
): IndividualFinalStanding[] {
  const stats = computeRotatingStats(matches, teams).filter(
    (s) => s.played > 0
  );
  if (stats.length === 0) return [];

  const dense = assignDensePositions(
    stats.map((s) => ({ teamId: s.participantId, score: s.matchPoints }))
  );
  return dense.map((d) => ({
    position: d.position,
    participantIds: d.teamIds,
  }));
}
