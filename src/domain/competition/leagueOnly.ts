/**
 * Format "league_only": una única lligueta amb tots els equips, sense
 * eliminatòria posterior. Internament reutilitzem la mateixa estructura
 * de "fase de grups" amb un sol grup, així podem reaprofitar
 * `groupStandings` per a la classificació i el càlcul de posicions finals.
 *
 * Decisions:
 *  - Mínim 2 equips (a diferència de "lligueta + bracket" que en demana 4).
 *  - El grup s'anomena `group_A` per consistència amb la UI existent.
 *  - Si es proporciona un `rng`, es barreja l'ordre dels equips (no canvia
 *    el resultat funcional, només l'ordre dels matches generats).
 */

import type { Match } from "../types";
import { generateRoundRobinMatches, type Group } from "./groupStage";
import { shuffle } from "./shuffle";

export const MIN_TEAMS_FOR_LEAGUE = 2;

let counter = 0;
const defaultMakeId = () =>
  `match_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export interface GenerateLeagueOnlyOptions {
  eventId: string;
  rng?: () => number;
  makeId?: () => string;
}

export function generateLeagueOnly(
  teamIds: string[],
  opts: GenerateLeagueOnlyOptions
): { groups: Group[]; matches: Match[] } {
  if (teamIds.length < MIN_TEAMS_FOR_LEAGUE) {
    throw new Error(
      `El format "Només lligueta" requereix almenys ${MIN_TEAMS_FOR_LEAGUE} equips.`
    );
  }
  const ordered = opts.rng ? shuffle(teamIds, opts.rng) : [...teamIds];
  const group: Group = { id: "group_A", teamIds: ordered };
  const matches = generateRoundRobinMatches(
    group,
    opts.eventId,
    opts.makeId ?? defaultMakeId
  );
  return { groups: [group], matches };
}
