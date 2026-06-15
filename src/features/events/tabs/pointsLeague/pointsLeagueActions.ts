/**
 * Accions de costat (side-effects) per al format `points_league_bracket`.
 *
 * Les decisions pures (quin roundNumber toca, com construir el config nou,
 * quins qualifiers passar al bracket-maker) viuen en funcions exportades
 * separadament i testejables sense haver de mockejar Firestore. Les
 * funcions de side-effect d'aquest fitxer són wrappers prims que orquestren
 * el càlcul pur + les escriptures.
 */

import {
  eventsRepo,
  matchesRepo,
  pointsRoundsRepo,
} from "@/data";
import { generateFirstRoundBracket } from "@/domain/competition/bracket";
import {
  computePointsLeagueStandings,
  selectTopQualifiers,
} from "@/domain/competition/pointsLeague";
import type {
  EventFormatConfig,
  Match,
  PointsRound,
  Team,
} from "@/domain/types";

// --- Decisions pures (testables) -----------------------------------------

/**
 * Calcula el roundNumber següent donada la llista d'existents.
 * Retorna 1 si no hi ha cap, en cas contrari max(roundNumber) + 1.
 */
export function nextRoundNumber(existingRounds: PointsRound[]): number {
  return existingRounds.reduce((max, r) => Math.max(max, r.roundNumber), 0) + 1;
}

/**
 * Genera un id raonablement únic per a una `PointsRound`. Es pot
 * sobreescriure passant `makeId` al wrapper si es vol determinisme als
 * tests.
 */
export function defaultMakeRoundId(roundNumber: number): string {
  return `round_${roundNumber}_${Date.now().toString(36)}`;
}

/**
 * Construeix una nova `PointsRound` buida amb el roundNumber adequat.
 */
export function buildNewRound(opts: {
  eventId: string;
  existingRounds: PointsRound[];
  makeId?: (roundNumber: number) => string;
}): PointsRound {
  const { eventId, existingRounds, makeId = defaultMakeRoundId } = opts;
  const roundNumber = nextRoundNumber(existingRounds);
  return {
    id: makeId(roundNumber),
    eventId,
    roundNumber,
    scores: {},
  };
}

/**
 * Pla de generació de bracket: retorna els qualifiers seleccionats, els
 * matches inicials de la primera ronda, i el `config` actualitzat amb
 * `bracketQualifiers` desat.
 */
export function planBracketGeneration(opts: {
  eventId: string;
  teams: Team[];
  rounds: PointsRound[];
  qualifierCount: number;
  config: EventFormatConfig;
  rng?: () => number;
  makeId?: () => string;
}): { qualifiers: string[]; matches: Match[]; nextConfig: EventFormatConfig } {
  const {
    eventId,
    teams,
    rounds,
    qualifierCount,
    config,
    rng,
    makeId,
  } = opts;
  const standings = computePointsLeagueStandings(teams, rounds);
  const qualifiers = selectTopQualifiers(standings, qualifierCount);
  if (qualifiers.length < 2) {
    throw new Error(
      "Calen almenys 2 classificats per generar l'eliminatòria."
    );
  }
  const matches = generateFirstRoundBracket(qualifiers, {
    eventId,
    rng,
    makeId,
  });
  const nextConfig: EventFormatConfig = {
    ...config,
    bracketQualifiers: qualifierCount,
  };
  return { qualifiers, matches, nextConfig };
}

/**
 * Calcula el `config` resultant de tornar a obrir la fase de bracket:
 * conserva la resta de camps però elimina `bracketQualifiers`.
 */
export function planBracketReset(config: EventFormatConfig): EventFormatConfig {
  const { bracketQualifiers: _omit, ...rest } = config;
  void _omit;
  return rest;
}

// --- Wrappers amb escriptura a Firestore ---------------------------------

export interface AddRoundParams {
  seasonId: string;
  eventId: string;
  existingRounds: PointsRound[];
}

export async function addEmptyRound(params: AddRoundParams): Promise<void> {
  const { seasonId, eventId, existingRounds } = params;
  const round = buildNewRound({ eventId, existingRounds });
  await pointsRoundsRepo.upsert(seasonId, eventId, round);
}

export interface GenerateBracketParams {
  seasonId: string;
  eventId: string;
  config: EventFormatConfig;
  teams: Team[];
  rounds: PointsRound[];
  qualifierCount: number;
}

export async function generatePointsLeagueBracket(
  params: GenerateBracketParams
): Promise<void> {
  const { seasonId, eventId, config, teams, rounds, qualifierCount } = params;
  const { matches, nextConfig } = planBracketGeneration({
    eventId,
    teams,
    rounds,
    qualifierCount,
    config,
  });
  await matchesRepo.bulkCreate(seasonId, eventId, matches);
  await eventsRepo.update(seasonId, eventId, { config: nextConfig });
}

export interface ResetBracketParams {
  seasonId: string;
  eventId: string;
  config: EventFormatConfig;
}

export async function resetBracketOnly(
  params: ResetBracketParams
): Promise<void> {
  const { seasonId, eventId, config } = params;
  await matchesRepo.clearAll(seasonId, eventId);
  await eventsRepo.update(seasonId, eventId, {
    config: planBracketReset(config),
  });
}
