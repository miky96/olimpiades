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
/** Punts segons posició final. */
export function pointsForPosition(position) {
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
/**
 * Calcula els punts totals d'un participant en un esdeveniment.
 * - `teamPosition` ve del rànquing final (empats densos).
 * - `attendance` conté bonus i penalització individuals.
 */
export function calculateParticipantPoints(participantId, teamPosition, attendance) {
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
export function calculateEventPoints(standings, teams, attendance) {
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const result = [];
    for (const s of standings) {
        for (const teamId of s.teamIds) {
            const team = teamById.get(teamId);
            if (!team)
                continue;
            for (const participantId of team.participantIds) {
                result.push(calculateParticipantPoints(participantId, s.position, attendance[participantId]));
            }
        }
    }
    // Participants apuntats però sense equip (p. ex. assistents a un event individual
    // que no apareixen a cap team) reben només bonus/penalització.
    const participantsWithTeam = new Set(result.map((r) => r.participantId));
    for (const [participantId, record] of Object.entries(attendance)) {
        if (participantsWithTeam.has(participantId))
            continue;
        if (!record)
            continue;
        result.push(calculateParticipantPoints(participantId, Number.POSITIVE_INFINITY, record));
    }
    return result;
}
/** Utilitat: agrega punts per participant (suma de múltiples esdeveniments). */
export function sumPointsByParticipant(breakdowns) {
    const totals = {};
    for (const b of breakdowns) {
        totals[b.participantId] = (totals[b.participantId] ?? 0) + b.total;
    }
    return totals;
}
