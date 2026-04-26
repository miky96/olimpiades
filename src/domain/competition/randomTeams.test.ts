import { describe, expect, it } from "vitest";
import { generateRandomTeams, planTeamSizes } from "./randomTeams";
import { seededRng } from "./shuffle";

const ids = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe("planTeamSizes", () => {
  it("repartiment exacte (N×M = total)", () => {
    expect(planTeamSizes(12, 4, 3)).toEqual([3, 3, 3, 3]);
  });

  it("dèficit: distribueix uniformement floor / floor+1", () => {
    // 10 entre 4 equips de 3: 3+3+2+2
    expect(planTeamSizes(10, 4, 3)).toEqual([3, 3, 2, 2]);
  });

  it("dèficit profund: alguns equips amb 1 menys", () => {
    // 9 entre 4 equips de 5: floor=2, extra=1 → 3,2,2,2
    expect(planTeamSizes(9, 4, 5)).toEqual([3, 2, 2, 2]);
  });

  it("superàvit: M garantida i sobrants en round-robin", () => {
    // 14 entre 4 equips de 3: cada un 3, surplus 2 → 4,4,3,3
    expect(planTeamSizes(14, 4, 3)).toEqual([4, 4, 3, 3]);
  });

  it("superàvit gran: surplus pot superar teamCount", () => {
    // 20 entre 4 equips de 3: cada un 3, surplus 8 → +2 a cadascun = 5,5,5,5
    expect(planTeamSizes(20, 4, 3)).toEqual([5, 5, 5, 5]);
  });

  it("totes les mides sumen el total", () => {
    for (let total = 2; total <= 30; total += 1) {
      for (let n = 2; n <= 6; n += 1) {
        for (let m = 1; m <= 5; m += 1) {
          const sizes = planTeamSizes(total, n, m);
          expect(sizes).toHaveLength(n);
          expect(sizes.reduce((a, b) => a + b, 0)).toBe(total);
        }
      }
    }
  });

  it("rebutja teamCount < 2", () => {
    expect(() => planTeamSizes(10, 1, 3)).toThrow();
  });

  it("rebutja membersPerTeam < 1", () => {
    expect(() => planTeamSizes(10, 4, 0)).toThrow();
  });
});

describe("generateRandomTeams", () => {
  it("crea N equips amb mides correctes i no descarta ningú", () => {
    const teams = generateRandomTeams({
      participantIds: ids(14),
      teamCount: 4,
      membersPerTeam: 3,
      rng: seededRng(42),
    });
    expect(teams).toHaveLength(4);
    expect(teams.map((t) => t.participantIds.length)).toEqual([4, 4, 3, 3]);
    const all = teams.flatMap((t) => t.participantIds);
    expect(new Set(all).size).toBe(14);
    expect(all.sort()).toEqual(ids(14).sort());
  });

  it("noms per defecte Equip A, Equip B, …", () => {
    const teams = generateRandomTeams({
      participantIds: ids(6),
      teamCount: 3,
      membersPerTeam: 2,
      rng: seededRng(1),
    });
    expect(teams.map((t) => t.name)).toEqual(["Equip A", "Equip B", "Equip C"]);
  });

  it("permet personalitzar el nom", () => {
    const teams = generateRandomTeams({
      participantIds: ids(4),
      teamCount: 2,
      membersPerTeam: 2,
      rng: seededRng(7),
      nameFor: (i) => `Equip #${i + 1}`,
    });
    expect(teams.map((t) => t.name)).toEqual(["Equip #1", "Equip #2"]);
  });

  it("és determinista amb el mateix seed", () => {
    const a = generateRandomTeams({
      participantIds: ids(10),
      teamCount: 3,
      membersPerTeam: 3,
      rng: seededRng(123),
    });
    const b = generateRandomTeams({
      participantIds: ids(10),
      teamCount: 3,
      membersPerTeam: 3,
      rng: seededRng(123),
    });
    expect(a).toEqual(b);
  });

  it("amb seeds diferents produeix repartiments diferents", () => {
    const a = generateRandomTeams({
      participantIds: ids(10),
      teamCount: 3,
      membersPerTeam: 3,
      rng: seededRng(1),
    });
    const b = generateRandomTeams({
      participantIds: ids(10),
      teamCount: 3,
      membersPerTeam: 3,
      rng: seededRng(2),
    });
    expect(a).not.toEqual(b);
  });

  it("error si participants < teamCount", () => {
    expect(() =>
      generateRandomTeams({
        participantIds: ids(3),
        teamCount: 4,
        membersPerTeam: 2,
      })
    ).toThrow(/3 participants presents.*4 equips/);
  });

  it("error si hi ha participants duplicats", () => {
    expect(() =>
      generateRandomTeams({
        participantIds: ["p1", "p2", "p1"],
        teamCount: 2,
        membersPerTeam: 2,
      })
    ).toThrow(/duplicats/);
  });
});
