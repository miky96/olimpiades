/**
 * Generador d'equips aleatori.
 *
 * Donat un conjunt de participants i una mida d'equips desitjada, reparteix
 * els participants en N equips de manera aleatòria amb distribució flexible:
 * - Mai descarta cap participant.
 * - Si N × M < total, els sobrants es reparteixen en round-robin (alguns
 *   equips queden amb M+1 o més).
 * - Si N × M > total, es distribueix el més uniformement possible (alguns
 *   equips queden amb M-1 o menys).
 *
 * Mòdul **pur**: no depèn de Firebase ni de cap adaptador.
 */

import { shuffle } from "./shuffle";

export interface RandomTeamPlan {
  /** Nom proposat per a l'equip (Equip A, Equip B, …). */
  name: string;
  /** IDs dels participants assignats a aquest equip. */
  participantIds: string[];
}

export interface GenerateRandomTeamsArgs {
  /** IDs dels participants presents que cal repartir. */
  participantIds: string[];
  /** Nombre d'equips a crear (>= 2). */
  teamCount: number;
  /** Membres objectiu per equip (>= 1). */
  membersPerTeam: number;
  /** PRNG injectable per fer-ho determinista en tests. Default Math.random. */
  rng?: () => number;
  /** Generador de nom per equip i (default "Equip A", "Equip B", ...). */
  nameFor?: (index: number) => string;
}

const DEFAULT_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function defaultNameFor(index: number): string {
  if (index < DEFAULT_LETTERS.length) return `Equip ${DEFAULT_LETTERS[index]}`;
  return `Equip ${index + 1}`;
}

/**
 * Calcula les mides finals de cada equip aplicant el repartiment flexible.
 * Útil per a previsualització a UI sense haver de córrer el shuffle.
 */
export function planTeamSizes(
  total: number,
  teamCount: number,
  membersPerTeam: number
): number[] {
  if (!Number.isInteger(teamCount) || teamCount < 2) {
    throw new Error("Es necessiten com a mínim 2 equips.");
  }
  if (!Number.isInteger(membersPerTeam) || membersPerTeam < 1) {
    throw new Error("Cada equip ha de tenir com a mínim 1 membre.");
  }
  if (!Number.isInteger(total) || total < 0) {
    throw new Error("El total de participants ha de ser un enter no negatiu.");
  }

  const target = teamCount * membersPerTeam;
  if (total <= target) {
    // Dèficit o just: distribució uniforme floor / floor+1.
    const base = Math.floor(total / teamCount);
    const extra = total % teamCount;
    return Array.from({ length: teamCount }, (_, i) =>
      i < extra ? base + 1 : base
    );
  }
  // Superàvit: cada equip rep M, surplus en round-robin.
  const sizes = new Array<number>(teamCount).fill(membersPerTeam);
  let surplus = total - target;
  let i = 0;
  while (surplus > 0) {
    sizes[i % teamCount] += 1;
    surplus -= 1;
    i += 1;
  }
  return sizes;
}

/**
 * Genera un repartiment aleatori d'equips.
 *
 * Llença error si:
 *  - teamCount < 2 o no és enter.
 *  - membersPerTeam < 1 o no és enter.
 *  - participantIds.length < teamCount (cada equip ha de tenir >= 1 membre).
 *  - participantIds té duplicats.
 */
export function generateRandomTeams(
  args: GenerateRandomTeamsArgs
): RandomTeamPlan[] {
  const {
    participantIds,
    teamCount,
    membersPerTeam,
    rng = Math.random,
    nameFor = defaultNameFor,
  } = args;

  if (new Set(participantIds).size !== participantIds.length) {
    throw new Error("Hi ha participants duplicats al repartiment.");
  }
  const total = participantIds.length;
  if (total < teamCount) {
    throw new Error(
      `Hi ha ${total} participant${
        total === 1 ? "" : "s"
      } presents però es demanen ${teamCount} equips.`
    );
  }

  const sizes = planTeamSizes(total, teamCount, membersPerTeam);
  const shuffled = shuffle(participantIds, rng);

  const teams: RandomTeamPlan[] = [];
  let cursor = 0;
  for (let t = 0; t < teamCount; t += 1) {
    const size = sizes[t];
    teams.push({
      name: nameFor(t),
      participantIds: shuffled.slice(cursor, cursor + size),
    });
    cursor += size;
  }
  return teams;
}
