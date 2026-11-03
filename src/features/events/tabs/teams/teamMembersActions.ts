/**
 * Side-effects per editar membres / competidors amb la competició en curs.
 * Les regles (què es pot fer) viuen a
 * `@/domain/competition/midCompetitionEdits`.
 */

import { attendanceRepo, matchesRepo, teamsRepo } from "@/data";
import { defaultsFor } from "@/domain/attendanceDefaults";
import {
  retargetUndecidedMatches,
  teamNeedsFork,
} from "@/domain/competition/midCompetitionEdits";
import type {
  AttendanceRecord,
  AttendanceStatus,
  Match,
  OlimpiadaEvent,
  Team,
} from "@/domain/types";

/**
 * Canvia els membres d'un equip. Si l'equip ja ha jugat partits decidits en
 * format rotatiu, en crea una còpia amb els nous membres i hi apunta els
 * partits pendents, així l'historial (i els punts) dels partits anteriors
 * no canvia.
 */
export async function changeTeamMembers(params: {
  seasonId: string;
  event: OlimpiadaEvent;
  team: Team;
  nextParticipantIds: string[];
  matches: Match[];
}): Promise<void> {
  const { seasonId, event, team, nextParticipantIds, matches } = params;
  if (teamNeedsFork(event, team, matches)) {
    const newId = await teamsRepo.create(seasonId, event.id, {
      name: team.name,
      participantIds: nextParticipantIds,
    });
    for (const m of retargetUndecidedMatches(matches, team.id, newId)) {
      await matchesRepo.upsert(seasonId, event.id, m);
    }
    return;
  }
  await teamsRepo.update(seasonId, event.id, team.id, {
    participantIds: nextParticipantIds,
  });
}

/**
 * Marca l'assistència d'un participant amb els valors per defecte de
 * l'estat (bonus/penalització). Conserva el comentari existent.
 */
export async function markAttendance(params: {
  seasonId: string;
  eventId: string;
  participantId: string;
  status: AttendanceStatus;
  existing?: AttendanceRecord;
}): Promise<void> {
  const { seasonId, eventId, participantId, status, existing } = params;
  const d = defaultsFor(status);
  await attendanceRepo.upsert(seasonId, eventId, {
    participantId,
    status,
    bonusPoints: d.bonusPoints,
    penaltyPoints: d.penaltyPoints,
    ...(existing?.comment ? { comment: existing.comment } : {}),
  });
}
