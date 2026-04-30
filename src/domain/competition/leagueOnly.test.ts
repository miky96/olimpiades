import { describe, expect, it } from "vitest";
import { initCompetition } from "./engine";
import { generateLeagueOnly } from "./leagueOnly";

let idCounter = 0;
const makeId = () => `m${idCounter++}`;

describe("generateLeagueOnly", () => {
  it("genera un únic grup amb tots els equips i un round-robin complet", () => {
    idCounter = 0;
    const r = generateLeagueOnly(["a", "b", "c", "d"], {
      eventId: "e1",
      makeId,
    });
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].teamIds).toEqual(["a", "b", "c", "d"]);
    // round-robin de 4 equips = 6 partits
    expect(r.matches).toHaveLength(6);
    for (const m of r.matches) {
      expect(m.phase).toBe("group");
      expect(m.groupId).toBe("group_A");
      expect(m.teamAId).not.toBeNull();
      expect(m.teamBId).not.toBeNull();
    }
  });

  it("accepta el mínim de 2 equips (1 sol partit de lliga)", () => {
    idCounter = 0;
    const r = generateLeagueOnly(["a", "b"], { eventId: "e1", makeId });
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].phase).toBe("group");
    expect(r.matches[0].groupId).toBe("group_A");
  });

  it("falla si hi ha menys de 2 equips", () => {
    expect(() => generateLeagueOnly(["a"], { eventId: "e1" })).toThrow();
    expect(() => generateLeagueOnly([], { eventId: "e1" })).toThrow();
  });
});

describe("initCompetition league_only", () => {
  it("delega a generateLeagueOnly i exposa els grups", () => {
    idCounter = 0;
    const r = initCompetition("league_only", {
      eventId: "e1",
      teamIds: ["a", "b", "c"],
      makeId,
    });
    expect(r.groups).toBeDefined();
    expect(r.groups!).toHaveLength(1);
    // round-robin 3 equips = 3 partits
    expect(r.matches).toHaveLength(3);
  });
});
