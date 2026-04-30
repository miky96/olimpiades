import { describe, expect, it } from "vitest";
import type { Match } from "./types";
import { computeLeagueFinalStandings } from "./finalStandings";

function gm(partial: Partial<Match>): Match {
  return {
    id: partial.id ?? "m",
    eventId: "ev",
    phase: "group",
    groupId: partial.groupId ?? "group_A",
    teamAId: partial.teamAId ?? null,
    teamBId: partial.teamBId ?? null,
    winnerTeamId: partial.winnerTeamId ?? null,
    round: partial.round,
    scoreA: partial.scoreA,
    scoreB: partial.scoreB,
  };
}

describe("computeLeagueFinalStandings", () => {
  it("ordena equips per punts (3 per victòria, 1 per empat) i empata a la mateixa posició si coincideixen els punts", () => {
    const matches: Match[] = [
      gm({ id: "1", teamAId: "A", teamBId: "B", winnerTeamId: "A" }),
      gm({ id: "2", teamAId: "A", teamBId: "C", winnerTeamId: "A" }),
      gm({
        id: "3",
        teamAId: "B",
        teamBId: "C",
        winnerTeamId: null,
        scoreA: 2,
        scoreB: 2,
      }),
    ];
    const standings = computeLeagueFinalStandings(["A", "B", "C"], matches);
    // A: 6 pts (1r). B i C: 1 pt cadascun → empat a 2a posició.
    expect(standings[0]).toEqual({ position: 1, teamIds: ["A"] });
    expect(standings[1].position).toBe(2);
    expect(standings[1].teamIds.sort()).toEqual(["B", "C"]);
  });

  it("equips empatats a punts comparteixen posició densa", () => {
    const matches: Match[] = [
      gm({ id: "1", teamAId: "A", teamBId: "B", winnerTeamId: "A" }),
      gm({ id: "2", teamAId: "C", teamBId: "D", winnerTeamId: "C" }),
    ];
    const standings = computeLeagueFinalStandings(
      ["A", "B", "C", "D"],
      matches
    );
    expect(standings).toEqual([
      { position: 1, teamIds: ["A", "C"] }, // 3 pts cadascun
      { position: 2, teamIds: ["B", "D"] }, // 0 pts cadascun
    ]);
  });

  it("ignora els matches que no són de fase de grups", () => {
    const matches: Match[] = [
      gm({ id: "1", teamAId: "A", teamBId: "B", winnerTeamId: "A" }),
      // un partit "single" o "final" no hauria de comptar a la lligueta
      {
        id: "2",
        eventId: "ev",
        phase: "final",
        teamAId: "B",
        teamBId: "A",
        winnerTeamId: "B",
      } as Match,
    ];
    const standings = computeLeagueFinalStandings(["A", "B"], matches);
    expect(standings[0].teamIds).toEqual(["A"]);
    expect(standings[1].teamIds).toEqual(["B"]);
  });

  it("equips sense partits queden a 0 punts (última posició)", () => {
    const matches: Match[] = [
      gm({ id: "1", teamAId: "A", teamBId: "B", winnerTeamId: "A" }),
    ];
    const standings = computeLeagueFinalStandings(["A", "B", "C"], matches);
    // A: 3, B: 0, C: 0 → posicions 1, 2, 2
    expect(standings[0]).toEqual({ position: 1, teamIds: ["A"] });
    expect(standings[1].position).toBe(2);
    expect(standings[1].teamIds.sort()).toEqual(["B", "C"]);
  });
});
