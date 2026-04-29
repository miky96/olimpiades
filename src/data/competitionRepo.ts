import { doc, writeBatch } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Match } from "@/domain/types";
import { paths } from "./collections";

/**
 * Coordinació transaccional d'operacions que afecten múltiples col·leccions
 * dins d'un esdeveniment.
 *
 * Aquest mòdul existeix per garantir atomicitat: una caiguda al mig d'un dels
 * fluxos crítics (iniciar / reiniciar / finalitzar competició) podria deixar
 * estats inconsistents si fessim updates separats.
 */

export interface StartCompetitionParams {
  seasonId: string;
  eventId: string;
  /**
   * Assignacions de grup per als teams. Buit (o omès) per formats sense fase
   * de grups.
   */
  teamGroupAssignments?: Array<{ teamId: string; groupId: string }>;
  /** Tots els matches inicials a crear. */
  matches: Match[];
}

export const competitionRepo = {
  /**
   * Inicia una competició atòmicament: assigna `groupId` als equips (si cal),
   * crea tots els matches inicials, i marca l'event com a `in_progress`.
   *
   * Si qualsevol pas falla, cap escriptura es persisteix (és una sola
   * `writeBatch` de Firestore).
   *
   * Límit pràctic: 500 operacions per batch. Per a un esdeveniment normal
   * (desenes d'equips i matches) hi ha marge sobrat.
   */
  async startCompetition(params: StartCompetitionParams): Promise<void> {
    const { seasonId, eventId, teamGroupAssignments, matches } = params;
    const db = getDb();
    const batch = writeBatch(db);

    if (teamGroupAssignments && teamGroupAssignments.length > 0) {
      for (const { teamId, groupId } of teamGroupAssignments) {
        batch.update(doc(db, paths.team(seasonId, eventId, teamId)), {
          groupId,
        });
      }
    }

    for (const m of matches) {
      batch.set(doc(db, paths.match(seasonId, eventId, m.id)), {
        eventId: m.eventId,
        phase: m.phase,
        groupId: m.groupId ?? null,
        round: m.round ?? null,
        teamAId: m.teamAId,
        teamBId: m.teamBId,
        winnerTeamId: m.winnerTeamId,
        scoreA: m.scoreA ?? null,
        scoreB: m.scoreB ?? null,
      });
    }

    batch.update(doc(db, paths.event(seasonId, eventId)), {
      status: "in_progress",
    });

    await batch.commit();
  },
};
