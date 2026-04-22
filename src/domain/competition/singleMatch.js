/**
 * Format "partit únic": dos equips juguen un sol partit, el guanyador queda 1r.
 */
export function generateSingleMatch(teamIds, opts) {
    const { eventId, makeId = () => `match_${Date.now().toString(36)}` } = opts;
    if (teamIds.length !== 2) {
        throw new Error("El format 'partit únic' requereix exactament 2 equips/participants.");
    }
    return [
        {
            id: makeId(),
            eventId,
            phase: "single",
            teamAId: teamIds[0],
            teamBId: teamIds[1],
            winnerTeamId: null,
        },
    ];
}
