/**
 * Regles de puntuació pures — no depenen de cap fitxer extern.
 *
 * Regles (veure docs/regles-negoci.md):
 *  - Posició 1 → 5 punts
 *  - Posició 2 → 3 punts
 *  - Posició 3 → 1 punts
 *  - Resta    → 0 punts
 *  - Bonus assistència i penalitzacions s'apliquen individualment per participant.
 *  - Empats: densos. Dos empatats a 1a reben 5 cadascun; el següent és 2a i rep 3.
 */

import type {
  AttendanceRecord,
  FinalStanding,
  IndividualFinalStanding,
  Match,
  Team,
} from "./types";
import { computeRotatingStats } from "./competition/rotatingSingles";

/** Punts segons posició final. */
export function pointsForPosition(position: number): number {
  switch (position) {
    case 1:
      return 5;
    case 2:
      return 3;
    case 3:
      return 1;
    default:
      return 0;
  }
}

export interface ParticipantPointsBreakdown {
  participantId: string;
  positionPoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  total: number;
  /**
   * Punts acumulats als partits del format individual (3 per victòria, 0 per
   * derrota). Només es desa per a `rotating_singles`. Informatiu, no es
   * sumen al `total` perquè la posició final ja s'aplica via `positionPoints`.
   */
  matchPoints?: number;
  /** Partits jugats (només `rotating_singles`). */
  matchesPlayed?: number;
  /** Partits guanyats (només `rotating_singles`). */
  matchesWon?: number;
}

/**
 * Calcula els punts totals d'un participant en un esdeveniment.
 * - `teamPosition` ve del rànquing final (empats densos).
 * - `attendance` conté bonus i penalització individuals.
 */
export function calculateParticipantPoints(
  participantId: string,
  teamPosition: number,
  attendance: AttendanceRecord | undefined
): ParticipantPointsBreakdown {
  const positionPoints = pointsForPosition(teamPosition);
  const bonusPoints = attendance?.bonusPoints ?? 0;
  const penaltyPoints = attendance?.penaltyPoints ?? 0;
  return {
    participantId,
    positionPoints,
    bonusPoints,
    penaltyPoints,
    total: positionPoints + bonusPoints + penaltyPoints,
  };
}

/**
 * Calcula els punts de tots els participants d'un esdeveniment.
 *
 * @param standings - Posicions finals per equip (amb empats densos).
 * @param teams     - Equips de l'esdeveniment amb la llista de participants.
 * @param attendance- Registres d'assistència indexats per participantId.
 */
export function calculateEventPoints(
  standings: FinalStanding[],
  teams: Team[],
  attendance: Record<string, AttendanceRecord | undefined>
): ParticipantPointsBreakdown[] {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const result: ParticipantPointsBreakdown[] = [];

  for (const s of standings) {
    for (const teamId of s.teamIds) {
      const team = teamById.get(teamId);
      if (!team) continue;
      for (const participantId of team.participantIds) {
        result.push(
          calculateParticipantPoints(
            participantId,
            s.position,
            attendance[participantId]
          )
        );
      }
    }
  }

  const participantsWithTeam = new Set(result.map((r) => r.participantId));
  for (const [participantId, record] of Object.entries(attendance)) {
    if (participantsWithTeam.has(participantId)) continue;
    if (!record) continue;
    result.push(
      calculateParticipantPoints(participantId, Number.POSITIVE_INFINITY, record)
    );
  }

  return result;
}

/** Utilitat: agrega punts per participant (suma de múltiples esdeveniments). */
export function sumPointsByParticipant(
  breakdowns: ParticipantPointsBreakdown[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const b of breakdowns) {
    totals[b.participantId] = (totals[b.participantId] ?? 0) + b.total;
  }
  return totals;
}

/**
 * Calcula els punts per participant per al format `rotating_singles`.
 *
 */
export function calculateRotatingEventPoints(args: {
  matches: Match[];
  teams: Team[];
  individualStandings: IndividualFinalStanding[];
  attendance: Record<string, AttendanceRecord | undefined>;
}): ParticipantPointsBreakdown[] {
  const { matches, teams, individualStandings, attendance } = args;

  const stats = computeRotatingStats(matches, teams);

  const positionByParticipant = new Map<string, number>();
  for (const s of individualStandings) {
    for (const pid of s.participantIds) {
      positionByParticipant.set(pid, s.position);
    }
  }

  const result: ParticipantPointsBreakdown[] = [];
  const seen = new Set<string>();

  for (const s of stats) {
    seen.add(s.participantId);
    const position =
      positionByParticipant.get(s.participantId) ?? Number.POSITIVE_INFINITY;
    const positionPoints = pointsForPosition(position);
    const att = attendance[s.participantId];
    const bonusPoints = att?.bonusPoints ?? 0;
    const penaltyPoints = att?.penaltyPoints ?? 0;
    result.push({
      participantId: s.participantId,
      positionPoints,
      bonusPoints,
      penaltyPoints,
      total: positionPoints + bonusPoints + penaltyPoints,
      matchPoints: s.matchPoints,
      matchesPlayed: s.played,
      matchesWon: s.won,
    });
  }

  for (const [participantId, record] of Object.entries(attendance)) {
    if (seen.has(participantId)) continue;
    if (!record) continue;
    const bonusPoints = record.bonusPoints ?? 0;
    const penaltyPoints = record.penaltyPoints ?? 0;
    result.push({
      participantId,
      positionPoints: 0,
      bonusPoints,
      penaltyPoints,
      total: bonusPoints + penaltyPoints,
      matchPoints: 0,
      matchesPlayed: 0,
      matchesWon: 0,
    });
  }

  return result;
}
