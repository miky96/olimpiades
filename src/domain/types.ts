/**
 * Tipus del domini de l'aplicació.
 * Aquest fitxer no depèn de Firebase ni de cap adaptador extern.
 */

export type Role = "superadmin" | "admin";
export type UserStatus = "active" | "blocked";

export interface AppUser {
  uid: string;
  email: string;
  role: Role;
  status: UserStatus;
}

export type SeasonStatus = "active" | "archived";

export interface Season {
  id: string;
  name: string;
  startDate: string; // ISO date
  endDate?: string; // ISO date, set quan s'arxiva
  status: SeasonStatus;
}

export interface Participant {
  id: string;
  seasonId: string;
  name: string;
  active: boolean;
}

export type EventFormat =
  | "single_match"
  | "bracket"
  | "group_stage_bracket";

export type EventStatus = "draft" | "in_progress" | "finished";

export interface EventFormatConfig {
  /** Mida de grup per a group_stage_bracket (3 o 4). */
  groupSize?: 3 | 4;
  /** Quants equips per grup passen a l'eliminatòria (per defecte 2). */
  qualifiersPerGroup?: number;
}

export interface OlimpiadaEvent {
  id: string;
  seasonId: string;
  date: string; // ISO
  sport: string;
  format: EventFormat;
  status: EventStatus;
  config: EventFormatConfig;
  /** Nom opcional (si l'admin vol afegir-ne un). */
  name?: string;
  /** Es persisteix quan es finalitza l'esdeveniment. */
  finalStandings?: FinalStanding[];
  /** Desglossament de punts per participant, guardat al finalitzar. */
  pointsBreakdown?: {
    participantId: string;
    positionPoints: number;
    bonusPoints: number;
    penaltyPoints: number;
    total: number;
  }[];
}

export interface Team {
  id: string;
  eventId: string;
  name: string;
  participantIds: string[];
  /** Només per a format "group_stage_bracket": grup assignat un cop iniciada la competició. */
  groupId?: string;
  /**
   * Timestamp (ms) del moment de creació. S'usa per ordenar equips per ordre
   * d'afegit. Opcional per compatibilitat amb documents antics.
   */
  createdAt?: number;
}

/**
 * Estats possibles d'assistència.
 * Cada estat té una penalització suggerida per defecte, però l'admin
 * pot sobreescriure-la amb el camp `penaltyPoints`.
 */
export type AttendanceStatus =
  | "present"
  | "late"
  | "absent_notified"
  | "absent_unnotified";

export interface AttendanceRecord {
  id: string;
  eventId: string;
  participantId: string;
  status: AttendanceStatus;
  /** Bonus per assistència (p. ex. +5 si present). */
  bonusPoints: number;
  /** Penalització aplicada (negativa o zero). Valor lliure decidit per l'admin. */
  penaltyPoints: number;
  /** Comentari opcional de l'admin (motiu de la penalització, etc.). */
  comment?: string;
}

export type MatchPhase =
  | "single"
  | "group"
  | "round_of_16"
  | "quarter"
  | "semi"
  | "final"
  | "third_place";

export interface Match {
  id: string;
  eventId: string;
  phase: MatchPhase;
  /** Per partits de fase de grups. */
  groupId?: string;
  /** Per partits d'eliminatòria (1 = primera ronda, 2 = següent...). */
  round?: number;
  /** Equip A. `null` si és un bye o encara no està assignat. */
  teamAId: string | null;
  /** Equip B. `null` si és un bye o encara no està assignat. */
  teamBId: string | null;
  /** Equip guanyador. `null` si encara no s'ha jugat. */
  winnerTeamId: string | null;
  scoreA?: number;
  scoreB?: number;
}

export interface FinalStanding {
  /** Posició final a l'esdeveniment (amb empats densos: 1, 1, 2, ...). */
  position: number;
  /** Equips que comparteixen aquesta posició (més d'un si hi ha empat). */
  teamIds: string[];
}
