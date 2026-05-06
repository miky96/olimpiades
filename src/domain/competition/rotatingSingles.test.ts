import { describe, expect, it } from "vitest";
import type { Match, Team } from "../types";
import {
  ROTATING_LOSS_POINTS,
  ROTATING_WIN_POINTS,
  areAllRotatingMatchesDecided,
  computeRotatingIndividualStandings,
  computeRotatingStats,
  createRotatingMatch,
  generateInitialRotatingMatch,
  lastRotatingRound,
  listRotatingMatches,
} from "./rotatingSingles";

function team(id: string, participantIds: string[]): Team {
  return {
    id,
    eventId: "ev",
    name: `Equip ${id}`,
    participantIds,
  };
}

function rmatch(partial: Partial<Match> & { round: number }): Match {
  return {
    id: partial.id ?? `m_${partial.round}`,
    eventId: "ev",
    phase: "rotating",
    round: partial.round,
    teamAId: partial.teamAId ?? null,
    teamBId: partial.teamBId ?? null,
    winnerTeamId: partial.winnerTeamId ?? null,
    scoreA: partial.scoreA,
    scoreB: partial.scoreB,
  };
}

describe("rotatingSingles — generació de partits", () => {
  it("crea un partit inicial amb round=1 i fase rotating", () => {
    const matches = generateInitialRotatingMatch(["A", "B"], {
      eventId: "ev",
      makeId: () => "m1",
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      id: "m1",
      eventId: "ev",
      phase: "rotating",
      round: 1,
      teamAId: "A",
      teamBId: "B",
      winnerTeamId: null,
    });
  });

  it("llença error si no hi ha exactament 2 equips", () => {
    expect(() =>
      generateInitialRotatingMatch(["A"], { eventId: "ev" })
    ).toThrow();
    expect(() =>
      generateInitialRotatingMatch(["A", "B", "C"], { eventId: "ev" })
    ).toThrow();
  });

  it("createRotatingMatch valida la ronda", () => {
    expect(() =>
      createRotatingMatch(["A", "B"], { eventId: "ev", round: 0 })
    ).toThrow();
    expect(() =>
      createRotatingMatch(["A", "B"], { eventId: "ev", round: 1.5 })
    ).toThrow();
  });

  it("createRotatingMatch produeix matches amb la ronda correcta", () => {
    const m = createRotatingMatch(["A", "B"], {
      eventId: "ev",
      round: 7,
      makeId: () => "x",
    });
    expect(m.round).toBe(7);
    expect(m.phase).toBe("rotating");
  });
});

describe("rotatingSingles — utilitats sobre llista de matches", () => {
  it("lastRotatingRound retorna 0 si no n'hi ha", () => {
    expect(lastRotatingRound([])).toBe(0);
  });

  it("lastRotatingRound ignora altres fases", () => {
    const matches: Match[] = [
      rmatch({ round: 2 }),
      { ...rmatch({ round: 99 }), phase: "single" },
    ];
    expect(lastRotatingRound(matches)).toBe(2);
  });

  it("listRotatingMatches ordena per ronda ascendent", () => {
    const matches: Match[] = [
      rmatch({ id: "c", round: 3 }),
      rmatch({ id: "a", round: 1 }),
      rmatch({ id: "b", round: 2 }),
    ];
    const ordered = listRotatingMatches(matches);
    expect(ordered.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("areAllRotatingMatchesDecided és true si tots tenen winner, false si en falta", () => {
    expect(
      areAllRotatingMatchesDecided([
        rmatch({ round: 1, teamAId: "A", teamBId: "B", winnerTeamId: "A" }),
      ])
    ).toBe(true);
    expect(
      areAllRotatingMatchesDecided([
        rmatch({ round: 1, teamAId: "A", teamBId: "B" }),
      ])
    ).toBe(false);
    // Vacuosament true si no n'hi ha cap.
    expect(areAllRotatingMatchesDecided([])).toBe(true);
  });
});

describe("rotatingSingles — estadístiques individuals", () => {
  it("acumula partits jugats, guanyats, perduts i punts (3/0)", () => {
    const teams: Team[] = [
      team("A", ["p1", "p2"]),
      team("B", ["p3", "p4"]),
    ];
    const matches: Match[] = [
      rmatch({
        id: "m1",
        round: 1,
        teamAId: "A",
        teamBId: "B",
        winnerTeamId: "A",
      }),
    ];
    const stats = computeRotatingStats(matches, teams);
    const byId = Object.fromEntries(stats.map((s) => [s.participantId, s]));
    expect(byId.p1).toEqual({
      participantId: "p1",
      played: 1,
      won: 1,
      lost: 0,
      matchPoints: ROTATING_WIN_POINTS,
    });
    expect(byId.p3).toEqual({
      participantId: "p3",
      played: 1,
      won: 0,
      lost: 1,
      matchPoints: ROTATING_LOSS_POINTS,
    });
  });

  it("suma punts a través de rondes amb composició d'equip diferent", () => {
    // Round 1: equips A=[p1,p2] vs B=[p3,p4], guanya A.
    // Round 2: equips A=[p1,p3] vs B=[p2,p4], guanya B.
    // p1: 1 victòria + 1 derrota = 3 + 0 = 3 punts (jugats: 2)
    // p4: 1 derrota + 1 victòria = 0 + 3 = 3 punts (jugats: 2)
    // p2: 1 victòria + 1 derrota = 3 punts (jugats: 2)
    // p3: 1 derrota + 1 victòria = 3 punts (jugats: 2)
    const teamsRound1: Team[] = [
      team("A1", ["p1", "p2"]),
      team("B1", ["p3", "p4"]),
    ];
    const teamsRound2: Team[] = [
      team("A2", ["p1", "p3"]),
      team("B2", ["p2", "p4"]),
    ];
    const matches: Match[] = [
      rmatch({
        id: "m1",
        round: 1,
        teamAId: "A1",
        teamBId: "B1",
        winnerTeamId: "A1",
      }),
      rmatch({
        id: "m2",
        round: 2,
        teamAId: "A2",
        teamBId: "B2",
        winnerTeamId: "B2",
      }),
    ];
    const stats = computeRotatingStats(matches, [
      ...teamsRound1,
      ...teamsRound2,
    ]);
    const byId = Object.fromEntries(stats.map((s) => [s.participantId, s]));
    for (const pid of ["p1", "p2", "p3", "p4"]) {
      expect(byId[pid].played).toBe(2);
      expect(byId[pid].matchPoints).toBe(3);
    }
  });

  it("ignora partits no resolts (sense winner)", () => {
    const teams: Team[] = [team("A", ["p1"]), team("B", ["p2"])];
    const matches: Match[] = [
      rmatch({ round: 1, teamAId: "A", teamBId: "B" }),
    ];
    const stats = computeRotatingStats(matches, teams);
    expect(stats).toEqual([]);
  });
});

describe("rotatingSingles — classificació individual final", () => {
  it("ordena per matchPoints descendent amb empats densos", () => {
    // Tres jugadors p1, p2, p3.
    // Round 1: A=[p1,p2] guanya a B=[p3] → p1=3, p2=3, p3=0
    // Round 2: A=[p1,p3] guanya a B=[p2] → p1=6, p3=3, p2=3
    // Final: p1 (6), p2 (3), p3 (3) → 1r p1, 2n p2 i p3 empatats.
    const teams: Team[] = [
      team("R1A", ["p1", "p2"]),
      team("R1B", ["p3"]),
      team("R2A", ["p1", "p3"]),
      team("R2B", ["p2"]),
    ];
    const matches: Match[] = [
      rmatch({
        id: "m1",
        round: 1,
        teamAId: "R1A",
        teamBId: "R1B",
        winnerTeamId: "R1A",
      }),
      rmatch({
        id: "m2",
        round: 2,
        teamAId: "R2A",
        teamBId: "R2B",
        winnerTeamId: "R2A",
      }),
    ];
    const standings = computeRotatingIndividualStandings(matches, teams);
    expect(standings).toHaveLength(2);
    expect(standings[0]).toEqual({ position: 1, participantIds: ["p1"] });
    expect(standings[1].position).toBe(2);
    expect(standings[1].participantIds.sort()).toEqual(["p2", "p3"]);
  });

  it("retorna [] si no s'ha jugat cap partit decidit", () => {
    const teams: Team[] = [team("A", ["p1"]), team("B", ["p2"])];
    const matches: Match[] = [
      rmatch({ round: 1, teamAId: "A", teamBId: "B" }),
    ];
    expect(computeRotatingIndividualStandings(matches, teams)).toEqual([]);
  });
});
