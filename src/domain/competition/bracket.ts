/**
 * Generació de brackets d'eliminatòria amb byes.
 *
 * Funcionament:
 *  - N equips → P = pròxima potència de 2 ≥ N.
 *  - byes = P - N. Als primers `byes` emparellaments (després de barrejar),
 *    l'equip "avança" directament (el match té teamBId = null i winner = teamAId).
 *  - Es genera la primera ronda completa. Les rondes posteriors es generen
 *    amb `advanceBracket` a mesura que s'introdueixen resultats.
 */

import type { Match, MatchPhase } from "../types";
import { shuffle } from "./shuffle";

export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(n));
}

/**
 * Retorna la fase corresponent segons quants partits queden fins a la final.
 * distance=0 → final; distance=1 → semi; distance=2 → quarter; distance=3 → round_of_16.
 * Per distàncies més grans usem "round_of_16" com a fallback; en una olimpíada
 * realista (4-16 equips) aquesta funció és més que suficient.
 */
export function phaseForRoundsToFinal(distance: number): MatchPhase {
  switch (distance) {
    case 0:
      return "final";
    case 1:
      return "semi";
    case 2:
      return "quarter";
    default:
      return "round_of_16";
  }
}

export interface GenerateBracketOptions {
  eventId: string;
  /** Injectable per tests. */
  rng?: () => number;
  /** Funció per generar IDs de match. Injectable per tests. */
  makeId?: () => string;
}

let counter = 0;
const defaultMakeId = () => `match_${Date.now().toString(36)}_${(counter++).toString(36)}`;

/**
 * Genera els matches de la primera ronda d'un bracket a partir de la llista d'equips.
 * Emparella barrejant i assigna byes quan el nombre d'equips no és potència de 2.
 */
export function generateFirstRoundBracket(
  teamIds: string[],
  opts: GenerateBracketOptions
): Match[] {
  const { eventId, rng, makeId = defaultMakeId } = opts;
  if (teamIds.length < 2) {
    throw new Error("Es necessiten almenys 2 equips per generar un bracket.");
  }

  const shuffled = shuffle(teamIds, rng);
  const p = nextPowerOfTwo(shuffled.length);
  const byes = p - shuffled.length;
  const totalRounds = Math.log2(p); // ex. 8 → 3 rondes (R1, semi, final)
  const phase = phaseForRoundsToFinal(totalRounds - 1);

  // Reparteix els byes: els primers `byes` equips passen directament.
  const byeTeams = shuffled.slice(0, byes);
  const playingTeams = shuffled.slice(byes);

  const matches: Match[] = [];

  // Matches de la primera ronda (equips que juguen).
  for (let i = 0; i < playingTeams.length; i += 2) {
    const a = playingTeams[i];
    const b = playingTeams[i + 1];
    matches.push({
      id: makeId(),
      eventId,
      phase,
      round: 1,
      teamAId: a,
      teamBId: b,
      winnerTeamId: null,
    });
  }

  // Byes: es representen com a matches "virtuals" amb guanyador pre-decidit.
  // Així la propera ronda pot generar-se uniformement.
  for (const t of byeTeams) {
    matches.push({
      id: makeId(),
      eventId,
      phase,
      round: 1,
      teamAId: t,
      teamBId: null,
      winnerTeamId: t,
    });
  }

  return matches;
}

/**
 * Genera la següent ronda a partir dels guanyadors de la ronda actual.
 * Retorna array buit si encara no tenim tots els guanyadors o si ja s'ha acabat.
 *
 * Cas especial: quan s'avança des de les semifinals cap a la final, també
 * es genera el partit de tercer lloc (`third_place`) amb els dos perdedors
 * de les semis. Aquest partit només es crea si tots dos semifinalistes han
 * jugat el partit (sense byes), ja que si no no hi ha dos perdedors reals.
 */
export function advanceBracket(
  currentRoundMatches: Match[],
  opts: { eventId: string; makeId?: () => string }
): Match[] {
  const { eventId, makeId = defaultMakeId } = opts;
  const winners: string[] = [];
  for (const m of currentRoundMatches) {
    if (!m.winnerTeamId) return []; // encara no hi ha tots els resultats
    winners.push(m.winnerTeamId);
  }
  if (winners.length < 2) return [];

  const nextRound = (currentRoundMatches[0].round ?? 1) + 1;
  const distance = Math.log2(winners.length) - 1;
  const phase = phaseForRoundsToFinal(distance);

  const matches: Match[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    matches.push({
      id: makeId(),
      eventId,
      phase,
      round: nextRound,
      teamAId: winners[i],
      teamBId: winners[i + 1] ?? null,
      winnerTeamId: null,
    });
  }

  // Si la ronda següent és la final (2 guanyadors), afegim la "final dels
  // perdedors" que decideix el 3r i 4t lloc amb els dos perdedors de la semi.
  if (phase === "final" && winners.length === 2) {
    const losers: string[] = [];
    for (const m of currentRoundMatches) {
      if (m.teamBId === null) continue; // bye: no hi ha perdedor real
      const loser =
        m.teamAId === m.winnerTeamId ? m.teamBId : m.teamAId;
      if (loser) losers.push(loser);
    }
    if (losers.length === 2) {
      matches.push({
        id: makeId(),
        eventId,
        phase: "third_place",
        round: nextRound,
        teamAId: losers[0],
        teamBId: losers[1],
        winnerTeamId: null,
      });
    }
  }

  return matches;
}
