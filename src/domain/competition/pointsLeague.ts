/**
 * Format `points_league_bracket`: lligueta individual basada en puntuació per
 * rondes (no en partits 1v1). Després opcionalment es genera un bracket amb
 * els X primers classificats per total de punts.
 *
 */

import type { FinalStanding, Match, PointsRound, Team } from "../types";
import { assignDensePositions } from "../positions";
import { computeBracketTier } from "../finalStandings";

/** Estadístiques per participant a la lligueta de punts. */
export interface PointsLeagueStanding {
  teamId: string;
  /** Suma de punts a totes les rondes. */
  total: number;
  /** Rondes en què el participant té un score explícit (>0 o explícitament 0). */
  roundsScored: number;
}

/**
 * Calcula el rànquing de la lligueta de punts.
 *
 */
export function computePointsLeagueStandings(
  teams: Team[],
  rounds: PointsRound[]
): PointsLeagueStanding[] {
  const totals = new Map<string, { total: number; roundsScored: number }>();
  for (const t of teams) {
    totals.set(t.id, { total: 0, roundsScored: 0 });
  }
  for (const r of rounds) {
    for (const [teamId, points] of Object.entries(r.scores)) {
      const entry = totals.get(teamId);
      if (!entry) continue;
      entry.total += points;
      entry.roundsScored += 1;
    }
  }
  return [...totals.entries()]
    .map(([teamId, v]) => ({
      teamId,
      total: v.total,
      roundsScored: v.roundsScored,
    }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.teamId.localeCompare(b.teamId);
    });
}

/**
 * Retorna els teamIds dels X primers classificats. Empats: si el límit
 * cau dins d'un grup d'empatats, tots els empatats hi entren (la mida del
 * grup pot acabar sent > X). El bracket-maker accepta nombres no-potencia
 * de 2, així que això és segur.
 */
export function selectTopQualifiers(
  standings: PointsLeagueStanding[],
  count: number
): string[] {
  if (count <= 0) return [];
  if (count >= standings.length) return standings.map((s) => s.teamId);

  const cutoffScore = standings[count - 1]?.total;
  if (cutoffScore == null) return standings.slice(0, count).map((s) => s.teamId);
  return standings
    .filter((s, idx) => idx < count || s.total === cutoffScore)
    .map((s) => s.teamId);
}

/**
 * Posicions finals per al format `points_league_bracket`.
 *
 */
export function computePointsLeagueFinalStandings(
  teams: Team[],
  rounds: PointsRound[],
  matches: Match[]
): FinalStanding[] {
  const leagueStandings = computePointsLeagueStandings(teams, rounds);

  const bracketMatches = matches.filter((m) => m.phase !== "group");
  if (bracketMatches.length === 0) {
    return assignDensePositions(
      leagueStandings.map((s) => ({ teamId: s.teamId, score: s.total }))
    );
  }

  const bracketTeamIds = new Set<string>();
  for (const m of bracketMatches) {
    if (m.teamAId) bracketTeamIds.add(m.teamAId);
    if (m.teamBId) bracketTeamIds.add(m.teamBId);
  }

  const NON_BRACKET_BASE = -1e9;

  const inputs = leagueStandings.map((s) => {
    if (bracketTeamIds.has(s.teamId)) {
      const tier = computeBracketTier(s.teamId, bracketMatches);
      return { teamId: s.teamId, score: tierToScore(tier) };
    }
    return { teamId: s.teamId, score: NON_BRACKET_BASE + s.total };
  });

  return assignDensePositions(inputs);
}

/**
 * Helper local: tier → score numèric. Duplicat lleuger respecte a
 * `finalStandings.ts` perquè aquell `tierScore` és privat (no exportat).
 * Si es vol unificar, caldria exportar-lo allà; per l'MVP, mantenir-ho
 * autocontingut és més simple i no afegeix risc.
 */
function tierToScore(tier: ReturnType<typeof computeBracketTier>): number {
  const TIER_BASE = 1_000;
  switch (tier.kind) {
    case "none":
      return 0;
    case "reached_round":
      return tier.round;
    case "third_place_loser":
      return TIER_BASE + 1;
    case "third_place_winner":
      return TIER_BASE + 2;
    case "final_loser":
      return TIER_BASE + 3;
    case "final_winner":
      return TIER_BASE + 4;
  }
}
