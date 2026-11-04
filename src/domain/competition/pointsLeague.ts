/**
 * Format `points_league_bracket`: lligueta individual per rondes (no en
 * partits 1v1). Després opcionalment es genera un bracket amb els X primers
 * classificats.
 *
 * Dos modes de puntuació (`config.pointsLeagueMode`):
 *  - "points" (per defecte): cada ronda dona punts i guanya qui en suma més.
 *  - "placement": cada ronda guarda la POSICIÓ de cada participant
 *    (1 = primer). Guanya qui ha quedat primer més cops; si hi ha empat, qui
 *    ha quedat segon més cops, i així successivament (sistema medaller).
 *    Reutilitzem el mateix mapa `scores` de `PointsRound` (valor = posició).
 */

import type { FinalStanding, Match, PointsRound, Team } from "../types";
import { assignDensePositions } from "../positions";
import { computeBracketTier } from "../finalStandings";

export type PointsLeagueMode = "points" | "placement";

/** Estadístiques per participant a la lligueta. */
export interface PointsLeagueStanding {
  teamId: string;
  /**
   * Mode "points": suma de punts a totes les rondes.
   * Mode "placement": nombre de vegades que ha quedat primer (clau principal).
   */
  total: number;
  /** Rondes en què el participant té un valor explícit. */
  roundsScored: number;
  /**
   * Només mode "placement": `placements[k]` = vegades que ha quedat en
   * posició k+1. Mateixa llargada per a tots els participants.
   */
  placements?: number[];
}

/** Una posició vàlida és un enter ≥ 1. */
export function isValidPlacement(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

/**
 * Comparador de la lligueta: total descendent i, en mode posicions,
 * desempat per recompte de posicions (més segons, més tercers, ...).
 * Retorna 0 si els dos participants estan empatats de debò.
 */
export function comparePointsLeagueStandings(
  a: PointsLeagueStanding,
  b: PointsLeagueStanding
): number {
  if (b.total !== a.total) return b.total - a.total;
  const pa = a.placements ?? [];
  const pb = b.placements ?? [];
  const len = Math.max(pa.length, pb.length);
  for (let k = 0; k < len; k++) {
    const diff = (pb[k] ?? 0) - (pa[k] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Calcula el rànquing de la lligueta. */
export function computePointsLeagueStandings(
  teams: Team[],
  rounds: PointsRound[],
  mode: PointsLeagueMode = "points"
): PointsLeagueStanding[] {
  const standings =
    mode === "placement"
      ? computePlacementEntries(teams, rounds)
      : computePointsEntries(teams, rounds);
  return standings.sort(
    (a, b) =>
      comparePointsLeagueStandings(a, b) || a.teamId.localeCompare(b.teamId)
  );
}

function computePointsEntries(
  teams: Team[],
  rounds: PointsRound[]
): PointsLeagueStanding[] {
  const totals = new Map<string, PointsLeagueStanding>();
  for (const t of teams) {
    totals.set(t.id, { teamId: t.id, total: 0, roundsScored: 0 });
  }
  for (const r of rounds) {
    for (const [teamId, points] of Object.entries(r.scores)) {
      const entry = totals.get(teamId);
      if (!entry) continue;
      entry.total += points;
      entry.roundsScored += 1;
    }
  }
  return [...totals.values()];
}

function computePlacementEntries(
  teams: Team[],
  rounds: PointsRound[]
): PointsLeagueStanding[] {
  const known = new Set(teams.map((t) => t.id));
  let maxPosition = 0;
  for (const r of rounds) {
    for (const [teamId, pos] of Object.entries(r.scores)) {
      if (known.has(teamId) && isValidPlacement(pos)) {
        maxPosition = Math.max(maxPosition, pos);
      }
    }
  }
  const entries = new Map<string, PointsLeagueStanding>();
  for (const t of teams) {
    entries.set(t.id, {
      teamId: t.id,
      total: 0,
      roundsScored: 0,
      placements: new Array<number>(maxPosition).fill(0),
    });
  }
  for (const r of rounds) {
    for (const [teamId, pos] of Object.entries(r.scores)) {
      const entry = entries.get(teamId);
      if (!entry || !isValidPlacement(pos)) continue;
      entry.placements![pos - 1] += 1;
      entry.roundsScored += 1;
    }
  }
  for (const entry of entries.values()) {
    entry.total = entry.placements![0] ?? 0;
  }
  return [...entries.values()];
}

/**
 * Rang dens (1, 1, 2, ...) de cada participant segons el comparador.
 * Assumeix `standings` ja ordenat amb `computePointsLeagueStandings`.
 */
function denseRanks(standings: PointsLeagueStanding[]): Map<string, number> {
  const ranks = new Map<string, number>();
  let rank = 0;
  standings.forEach((s, idx) => {
    if (idx === 0 || comparePointsLeagueStandings(standings[idx - 1], s) !== 0) {
      rank += 1;
    }
    ranks.set(s.teamId, rank);
  });
  return ranks;
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

  const cutoff = standings[count - 1];
  if (cutoff == null) return standings.slice(0, count).map((s) => s.teamId);
  return standings
    .filter(
      (s, idx) => idx < count || comparePointsLeagueStandings(s, cutoff) === 0
    )
    .map((s) => s.teamId);
}

/** Posicions finals per al format `points_league_bracket`. */
export function computePointsLeagueFinalStandings(
  teams: Team[],
  rounds: PointsRound[],
  matches: Match[],
  mode: PointsLeagueMode = "points"
): FinalStanding[] {
  const leagueStandings = computePointsLeagueStandings(teams, rounds, mode);
  const ranks = denseRanks(leagueStandings);
  const leagueScore = (teamId: string) => -(ranks.get(teamId) ?? 0);

  const bracketMatches = matches.filter((m) => m.phase !== "group");
  if (bracketMatches.length === 0) {
    return assignDensePositions(
      leagueStandings.map((s) => ({ teamId: s.teamId, score: leagueScore(s.teamId) }))
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
    return { teamId: s.teamId, score: NON_BRACKET_BASE + leagueScore(s.teamId) };
  });

  return assignDensePositions(inputs);
}

/**
 * Helper local: tier → score numèric. Duplicat lleuger respecte a
 * `finalStandings.ts` perquè aquell `tierScore` és privat (no exportat).
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
