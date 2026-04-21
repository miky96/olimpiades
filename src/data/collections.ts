/**
 * Helpers centralitzats per a les rutes de col·leccions Firestore.
 * Tenir-les en un sol lloc facilita refactoritzar l'esquema més endavant.
 */

export const paths = {
  users: () => "users",
  user: (uid: string) => `users/${uid}`,

  seasons: () => "seasons",
  season: (seasonId: string) => `seasons/${seasonId}`,

  participants: (seasonId: string) => `seasons/${seasonId}/participants`,
  participant: (seasonId: string, participantId: string) =>
    `seasons/${seasonId}/participants/${participantId}`,

  events: (seasonId: string) => `seasons/${seasonId}/events`,
  event: (seasonId: string, eventId: string) =>
    `seasons/${seasonId}/events/${eventId}`,

  teams: (seasonId: string, eventId: string) =>
    `seasons/${seasonId}/events/${eventId}/teams`,
  team: (seasonId: string, eventId: string, teamId: string) =>
    `seasons/${seasonId}/events/${eventId}/teams/${teamId}`,

  attendance: (seasonId: string, eventId: string) =>
    `seasons/${seasonId}/events/${eventId}/attendance`,
  attendanceRecord: (seasonId: string, eventId: string, participantId: string) =>
    `seasons/${seasonId}/events/${eventId}/attendance/${participantId}`,

  matches: (seasonId: string, eventId: string) =>
    `seasons/${seasonId}/events/${eventId}/matches`,
  match: (seasonId: string, eventId: string, matchId: string) =>
    `seasons/${seasonId}/events/${eventId}/matches/${matchId}`,

  finalStandings: (seasonId: string, eventId: string) =>
    `seasons/${seasonId}/events/${eventId}/finalStandings`,
} as const;
