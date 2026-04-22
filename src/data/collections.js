/**
 * Helpers centralitzats per a les rutes de col·leccions Firestore.
 * Tenir-les en un sol lloc facilita refactoritzar l'esquema més endavant.
 */
export const paths = {
    users: () => "users",
    user: (uid) => `users/${uid}`,
    seasons: () => "seasons",
    season: (seasonId) => `seasons/${seasonId}`,
    participants: (seasonId) => `seasons/${seasonId}/participants`,
    participant: (seasonId, participantId) => `seasons/${seasonId}/participants/${participantId}`,
    events: (seasonId) => `seasons/${seasonId}/events`,
    event: (seasonId, eventId) => `seasons/${seasonId}/events/${eventId}`,
    teams: (seasonId, eventId) => `seasons/${seasonId}/events/${eventId}/teams`,
    team: (seasonId, eventId, teamId) => `seasons/${seasonId}/events/${eventId}/teams/${teamId}`,
    attendance: (seasonId, eventId) => `seasons/${seasonId}/events/${eventId}/attendance`,
    attendanceRecord: (seasonId, eventId, participantId) => `seasons/${seasonId}/events/${eventId}/attendance/${participantId}`,
    matches: (seasonId, eventId) => `seasons/${seasonId}/events/${eventId}/matches`,
    match: (seasonId, eventId, matchId) => `seasons/${seasonId}/events/${eventId}/matches/${matchId}`,
    finalStandings: (seasonId, eventId) => `seasons/${seasonId}/events/${eventId}/finalStandings`,
};
