import { describe, expect, it } from "vitest";
import { initCompetition } from "./engine";
import { nextPowerOfTwo, advanceBracket } from "./bracket";
import { buildGroups, generateRoundRobinMatches, groupStandings } from "./groupStage";
import { seededRng } from "./shuffle";

let idCounter = 0;
const makeId = () => `m${idCounter++}`;

describe("nextPowerOfTwo", () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 4],
    [5, 8],
    [8, 8],
    [9, 16],
  ])("nextPowerOfTwo(%i) == %i", (n, expected) => {
    expect(nextPowerOfTwo(n)).toBe(expected);
  });
});

describe("initCompetition single_match", () => {
  it("crea un sol partit", () => {
    idCounter = 0;
    const r = initCompetition("single_match", {
      eventId: "e1",
      teamIds: ["t1", "t2"],
      makeId,
    });
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].phase).toBe("single");
  });

  it("llança error si no hi ha exactament 2 equips", () => {
    expect(() =>
      initCompetition("single_match", { eventId: "e1", teamIds: ["t1"] })
    ).toThrow();
  });
});

describe("initCompetition bracket", () => {
  it("amb 4 equips crea 2 matches de semis, sense byes", () => {
    idCounter = 0;
    const r = initCompetition("bracket", {
      eventId: "e1",
      teamIds: ["a", "b", "c", "d"],
      rng: seededRng(42),
      makeId,
    });
    expect(r.matches).toHaveLength(2);
    for (const m of r.matches) {
      expect(m.phase).toBe("semi");
      expect(m.teamAId).not.toBeNull();
      expect(m.teamBId).not.toBeNull();
    }
  });

  it("amb 6 equips crea matches amb 2 byes (8 resultats a la primera ronda)", () => {
    idCounter = 0;
    const r = initCompetition("bracket", {
      eventId: "e1",
      teamIds: ["a", "b", "c", "d", "e", "f"],
      rng: seededRng(7),
      makeId,
    });
    // 2 byes + 2 matches jugats = 4 "slots" a la primera ronda virtual,
    // però els byes són matches "virtuals" resolts.
    const byes = r.matches.filter((m) => m.teamBId === null);
    const played = r.matches.filter((m) => m.teamBId !== null);
    expect(byes).toHaveLength(2);
    expect(played).toHaveLength(2);
    for (const m of byes) {
      expect(m.winnerTeamId).toBe(m.teamAId);
    }
  });
});

describe("advanceBracket", () => {
  it("genera la següent ronda quan tots els matches tenen guanyador", () => {
    idCounter = 0;
    const r = initCompetition("bracket", {
      eventId: "e1",
      teamIds: ["a", "b", "c", "d"],
      rng: seededRng(42),
      makeId,
    });
    const withWinners = r.matches.map((m) => ({
      ...m,
      winnerTeamId: m.teamAId,
    }));
    const next = advanceBracket(withWinners, { eventId: "e1", makeId });
    expect(next).toHaveLength(1);
    expect(next[0].phase).toBe("final");
  });

  it("retorna buit si encara falten resultats", () => {
    const r = initCompetition("bracket", {
      eventId: "e1",
      teamIds: ["a", "b", "c", "d"],
      rng: seededRng(42),
      makeId,
    });
    const next = advanceBracket(r.matches, { eventId: "e1", makeId });
    expect(next).toEqual([]);
  });
});

describe("group stage", () => {
  it("reparteix 8 equips en 2 grups de 4", () => {
    const groups = buildGroups(
      ["a", "b", "c", "d", "e", "f", "g", "h"],
      4,
      seededRng(1)
    );
    expect(groups).toHaveLength(2);
    for (const g of groups) {
      expect(g.teamIds).toHaveLength(4);
    }
  });

  it("genera round-robin complet (3 equips = 3 partits)", () => {
    const matches = generateRoundRobinMatches(
      { id: "A", teamIds: ["a", "b", "c"] },
      "e1",
      makeId
    );
    expect(matches).toHaveLength(3);
  });

  it("genera round-robin complet (4 equips = 6 partits)", () => {
    const matches = generateRoundRobinMatches(
      { id: "A", teamIds: ["a", "b", "c", "d"] },
      "e1",
      makeId
    );
    expect(matches).toHaveLength(6);
  });

  it("requereix mínim 4 equips per formar grups", () => {
    expect(() => buildGroups(["a", "b", "c"], 4)).toThrow();
  });

  it("sense rng, manté l'ordre d'entrada (grup A = primers, grup B = següents...)", () => {
    const input = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];
    const groups = buildGroups(input, 4);
    expect(groups).toHaveLength(2);
    expect(groups[0].id).toBe("group_A");
    expect(groups[0].teamIds).toEqual(["t1", "t2", "t3", "t4"]);
    expect(groups[1].id).toBe("group_B");
    expect(groups[1].teamIds).toEqual(["t5", "t6", "t7", "t8"]);
  });

  it("amb rng, barreja els equips (diferent de l'ordre d'entrada)", () => {
    const input = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];
    const groups = buildGroups(input, 4, seededRng(1));
    const flat = groups.flatMap((g) => g.teamIds);
    // Mateixos elements, ordre diferent.
    expect(flat.slice().sort()).toEqual(input.slice().sort());
    expect(flat).not.toEqual(input);
  });

  it("initCompetition(group_stage_bracket) sense rng conserva l'ordre dels teamIds", () => {
    idCounter = 0;
    const teamIds = ["a", "b", "c", "d", "e", "f"];
    const r = initCompetition("group_stage_bracket", {
      eventId: "e1",
      teamIds,
      config: { groupSize: 3 },
      makeId,
    });
    expect(r.groups).toBeDefined();
    expect(r.groups!).toHaveLength(2);
    expect(r.groups![0].teamIds).toEqual(["a", "b", "c"]);
    expect(r.groups![1].teamIds).toEqual(["d", "e", "f"]);
  });

  it("classificació de grup ordena per punts (3 per victòria, 1 per empat)", () => {
    const group = { id: "A", teamIds: ["a", "b", "c"] };
    const matches = generateRoundRobinMatches(group, "e1", makeId).map((m) => {
      // A guanya sempre; B guanya C
      if (m.teamAId === "a") return { ...m, winnerTeamId: "a" };
      if (m.teamBId === "a") return { ...m, winnerTeamId: "a" };
      return { ...m, winnerTeamId: "b" };
    });
    const standings = groupStandings(group, matches);
    expect(standings[0].teamId).toBe("a");
    expect(standings[0].points).toBe(6);
    expect(standings[1].teamId).toBe("b");
    expect(standings[1].points).toBe(3);
    expect(standings[2].teamId).toBe("c");
    expect(standings[2].points).toBe(0);
  });
});
