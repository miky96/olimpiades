/**
 * Regles per editar la composició d'un esdeveniment un cop iniciada la
 * competició (algú que falta o que arriba tard).
 *
 * Mòdul pur: decideix QUÈ es pot fer; la UI i els repos fan el COM.
 *
 * Criteris:
 *  - Formats per equips: es poden afegir/treure membres dels equips
 *    existents (els partits apunten a l'equip, no als membres). La posició
 *    final de l'equip s'aplica als membres que hi hagi en finalitzar.
 *  - `rotating_singles`: només els equips del partit en curs (sense
 *    guanyador). Si aquell equip ja ha jugat partits decidits, cal
 *    "bifurcar-lo" (crear-ne una còpia) per no reescriure l'historial.
 *  - Formats individuals per puntuació (`points_league_bracket`,
 *    `score_ranking`): es poden afegir competidors nous i treure'n mentre
 *    no apareguin a cap partit (bracket).
 *  - Formats individuals per partits (lligueta / grups): no es pot canviar
 *    res sense reiniciar (caldria regenerar el calendari).
 */

import type { EventFormat, EventFormatConfig, EventStatus, Match, Team } from "../types";
import { isIndividualMode } from "../formatLabels";

interface EventLike {
  format: EventFormat;
  config: EventFormatConfig | undefined;
  status: EventStatus;
}

export const SCORE_BASED_FORMATS: ReadonlyArray<EventFormat> = [
  "points_league_bracket",
  "score_ranking",
];

function involves(m: Match, teamId: string): boolean {
  return m.teamAId === teamId || m.teamBId === teamId;
}

/** Equips dels partits rotatius encara sense guanyador. */
export function currentRotatingTeamIds(matches: Match[]): Set<string> {
  const ids = new Set<string>();
  for (const m of matches) {
    if (m.phase !== "rotating" || m.winnerTeamId !== null) continue;
    if (m.teamAId) ids.add(m.teamAId);
    if (m.teamBId) ids.add(m.teamBId);
  }
  return ids;
}

export function canEditTeamMembers(
  event: EventLike,
  team: Team,
  matches: Match[]
): boolean {
  if (event.status === "draft") return true;
  if (event.status !== "in_progress") return false;
  if (isIndividualMode(event.format, event.config)) return false;
  if (event.format === "rotating_singles") {
    return currentRotatingTeamIds(matches).has(team.id);
  }
  return true;
}

/** Cal crear una còpia de l'equip abans de canviar-ne els membres? */
export function teamNeedsFork(
  event: EventLike,
  team: Team,
  matches: Match[]
): boolean {
  if (event.status !== "in_progress") return false;
  if (event.format !== "rotating_singles") return false;
  return matches.some((m) => m.winnerTeamId !== null && involves(m, team.id));
}

export function canAddCompetitorMidway(event: EventLike): boolean {
  return (
    event.status === "in_progress" &&
    SCORE_BASED_FORMATS.includes(event.format) &&
    isIndividualMode(event.format, event.config)
  );
}

export function canRemoveCompetitorMidway(
  event: EventLike,
  team: Team,
  matches: Match[]
): boolean {
  return (
    canAddCompetitorMidway(event) && !matches.some((m) => involves(m, team.id))
  );
}

/**
 * Participants que ja estan "ocupats" en algun equip. En `rotating_singles`
 * en curs només compten els equips del partit actual (els equips antics
 * són historial).
 */
export function assignedParticipantIds(
  event: EventLike,
  teams: Team[],
  matches: Match[]
): Set<string> {
  const relevant =
    event.status === "in_progress" && event.format === "rotating_singles"
      ? teams.filter((t) => currentRotatingTeamIds(matches).has(t.id))
      : teams;
  const ids = new Set<string>();
  for (const t of relevant) for (const pid of t.participantIds) ids.add(pid);
  return ids;
}

/**
 * Substitueix `fromTeamId` per `toTeamId` als partits encara no decidits.
 * Retorna només els partits modificats.
 */
export function retargetUndecidedMatches(
  matches: Match[],
  fromTeamId: string,
  toTeamId: string
): Match[] {
  return matches
    .filter((m) => m.winnerTeamId === null && involves(m, fromTeamId))
    .map((m) => ({
      ...m,
      teamAId: m.teamAId === fromTeamId ? toTeamId : m.teamAId,
      teamBId: m.teamBId === fromTeamId ? toTeamId : m.teamBId,
    }));
}
