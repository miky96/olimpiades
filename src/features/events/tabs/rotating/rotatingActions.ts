/**
 * Helpers d'orquestració per al format `rotating_singles`. Aïlla la
 * coordinació entre el domini (regles pures) i els repos (Firestore).
 */

import type { AttendanceRecord, Match, Participant, Team } from "@/domain/types";
import { matchesRepo, teamsRepo } from "@/data";
import { selectPresentParticipants } from "@/domain/attendance";
import {
  createRotatingMatch,
  generateRandomTeams,
  lastRotatingRound,
} from "@/domain";

export interface AddNextRoundParams {
  seasonId: string;
  eventId: string;
  matches: Match[];
  teams: Team[];
  participants: Participant[];
  attendance: AttendanceRecord[];
  /** Si true, regenera 2 equips nous a partir dels participants presents. */
  regenerate: boolean;
}

/** Mida d'equip suggerida per a la regeneració: divisió equilibrada en 2. */
export function suggestRotatingTeamSize(total: number): number {
  if (total < 2) return 1;
  return Math.ceil(total / 2);
}

/**
 * Crea el següent partit del format rotating. Si `regenerate` és true, també
 * crea 2 equips nous amb els participants presents distribuïts a l'atzar.
 *
 * Simplificacions deliberades (MVP):
 *  - L'operació no és atòmica: si la creació dels teams reeixeix però la del
 *    match falla, queden teams "orfes". Ho considerem acceptable per ara
 *    perquè és recuperable manualment i poc probable. Si calgués atomicitat,
 *    es pot afegir un mètode al `competitionRepo`.
 */
export async function addNextRotatingRound(
  params: AddNextRoundParams
): Promise<void> {
  const {
    seasonId,
    eventId,
    matches,
    teams,
    participants,
    attendance,
    regenerate,
  } = params;

  const round = lastRotatingRound(matches) + 1;

  let teamAId: string;
  let teamBId: string;

  if (regenerate) {
    const present = selectPresentParticipants(participants, attendance);
    if (present.length < 2) {
      throw new Error(
        "Calen com a mínim 2 participants amb estat 'present' per regenerar els equips."
      );
    }
    const plans = generateRandomTeams({
      participantIds: present.map((p) => p.id),
      teamCount: 2,
      membersPerTeam: suggestRotatingTeamSize(present.length),
      nameFor: (i) => `Equip ${"AB"[i] ?? i + 1} · R${round}`,
    });
    const newIds: string[] = [];
    for (const plan of plans) {
      const id = await teamsRepo.create(seasonId, eventId, {
        name: plan.name,
        participantIds: plan.participantIds,
      });
      newIds.push(id);
    }
    [teamAId, teamBId] = newIds;
  } else {
    const lastRoundMatch = matches
      .filter((m) => m.phase === "rotating")
      .sort((a, b) => (b.round ?? 0) - (a.round ?? 0))[0];
    if (!lastRoundMatch || !lastRoundMatch.teamAId || !lastRoundMatch.teamBId) {
      if (teams.length < 2) {
        throw new Error("No hi ha 2 equips disponibles per reutilitzar.");
      }
      teamAId = teams[0].id;
      teamBId = teams[1].id;
    } else {
      teamAId = lastRoundMatch.teamAId;
      teamBId = lastRoundMatch.teamBId;
    }
  }

  const next = createRotatingMatch([teamAId, teamBId], { eventId, round });
  await matchesRepo.bulkCreate(seasonId, eventId, [next]);
}
