import { describe, expect, it } from "vitest";
import type { Match } from "./types";
import {
  areAllMatchesDecided,
  computeBracketTier,
  computeFinalStandings,
} from "./finalStandings";

function m(partial: Partial<Match>): Match {
  return {
    id: partial.id ?? "m",
    eventId: "ev",
    phase: partial.phase ?? "final",
    teamAId: partial.teamAId ?? null,
    teamBId: partial.teamBId ?? null,
    winnerTeamId: partial.winnerTeamId ?? null,
    round: partial.round,
    groupId: partial.groupId,
    scoreA: partial.scoreA,
    scoreB: partial.scoreB,
  };
}

describe("computeBracketTier", () => {
  it("sense partit de 3r: campió, subcampió i semifinalistes sense tier", () => {
    const matches: Match[] = [
      m({ id: "1", phase: "semi", round: 1, teamAId: "A", teamBId: "B", winnerTeamId: "A" }),
      m({ id: "2", phase: "semi", round: 1, teamAId: "C", teamBId: "D", winnerTeamId: "C" }),
      m({ id: "3", phase: "final", round: 2, teamAId: "A", teamBId: "C", winnerTeamId: "A" }),
    ];
    expect(computeBracketTier("A", matches)).toEqual({ kind: "final_winner" });
    expect(computeBracketTier("C", matches)).toEqual({ kind: "final_loser" });
    expect(computeBracketTier("B", matches)).toEqual({ kind: "none" });
    expect(computeBracketTier("D", matches)).toEqual({ kind: "none" });
  });

  it("amb partit de 3r lloc: cada equip rep el tier corresponent", () => {
    const matches: Match[] = [
      m({ id: "1", phase: "semi", round: 1, teamAId: "A", teamBId: "B", winnerTeamId: "A" }),
      m({ id: "2", phase: "semi", round: 1, teamAId: "C", teamBId: "D", winnerTeamId: "C" }),
      m({ id: "3", phase: "final", round: 2, teamAId: "A", teamBId: "C", winnerTeamId: "A" }),
      m({ id: "4", phase: "third_place", round: 2, teamAId: "B", teamBId: "D", winnerTeamId: "B" }),
    ];
    expect(computeBracketTier("A", matches)).toEqual({ kind: "final_winner" });
    expect(computeBracketTier("C", matches)).toEqual({ kind: "final_loser" });
    expect(computeBracketTier("B", matches)).toEqual({ kind: "third_place_winner" });
    expect(computeBracketTier("D", matches)).toEqual({ kind: "third_place_loser" });
  });

  it("single_match: guanyador -> final_winner, perdedor -> final_loser", () => {
    const matches: Match[] = [
      m({ id: "1", phase: "single", teamAId: "X", teamBId: "Y", winnerTeamId: "Y" }),
    ];
    expect(computeBracketTier("Y", matches)).toEqual({ kind: "final_winner" });
    expect(computeBracketTier("X", matches)).toEqual({ kind: "final_loser" });
  });

  it("equip eliminat a quarts rep reached_round amb la ronda on va guanyar", () => {
    const matches: Match[] = [
      m({ id: "1", phase: "quarter", round: 1, teamAId: "A", teamBId: "B", winnerTeamId: "A" }),
      m({ id: "2", phase: "semi", round: 2, teamAId: "A", teamBId: "C", winnerTeamId: "C" }),
    ];
    expect(computeBracketTier("A", matches)).toEqual({
      kind: "reached_round",
      round: 1,
    });
    expect(computeBracketTier("B", matches)).toEqual({ kind: "none" });
  });

  it("la fase de grups no afecta el tier", () => {
    const matches: Match[] = [
      m({
        id: "1",
        phase: "group",
        groupId: "group_A",
        teamAId: "A",
        teamBId: "B",
        winnerTeamId: "A",
      }),
    ];
    expect(computeBracketTier("A", matches)).toEqual({ kind: "none" });
  });
});

describe("computeFinalStandings", () => {
  it("bracket 4 equips sense partit de 3r: els dos semifinalistes queden empatats a la 3a posició", () => {
    const matches: Match[] = [
      m({ id: "1", phase: "semi", round: 1, teamAId: "A", teamBId: "B", winnerTeamId: "A" }),
      m({ id: "2", phase: "semi", round: 1, teamAId: "C", teamBId: "D", winnerTeamId: "C" }),
      m({ id: "3", phase: "final", round: 2, teamAId: "A", teamBId: "C", winnerTeamId: "A" }),
    ];
    const standings = computeFinalStandings(["A", "B", "C", "D"], matches);
    expect(standings[0].position).toBe(1);
    expect(standings[0].teamIds).toEqual(["A"]);
    expect(standings[1].position).toBe(2);
    expect(standings[1].teamIds).toEqual(["C"]);
    expect(standings[2].position).toBe(3);
    expect(standings[2].teamIds.sort()).toEqual(["B", "D"]);
  });

  it("bracket 4 equips amb partit de 3r: 1r / 2n / 3r / 4t queden separats", () => {
    const matches: Match[] = [
      m({ id: "1", phase: "semi", round: 1, teamAId: "A", teamBId: "B", winnerTeamId: "A" }),
      m({ id: "2", phase: "semi", round: 1, teamAId: "C", teamBId: "D", winnerTeamId: "C" }),
      m({ id: "3", phase: "final", round: 2, teamAId: "A", teamBId: "C", winnerTeamId: "A" }),
      m({ id: "4", phase: "third_place", round: 2, teamAId: "B", teamBId: "D", winnerTeamId: "B" }),
    ];
    const standings = computeFinalStandings(["A", "B", "C", "D"], matches);
    expect(standings).toEqual([
      { position: 1, teamIds: ["A"] },
      { position: 2, teamIds: ["C"] },
      { position: 3, teamIds: ["B"] },
      { position: 4, teamIds: ["D"] },
    ]);
  });

  it("single match: winner pos 1, loser pos 2", () => {
    const matches: Match[] = [
      m({ id: "1", phase: "single", teamAId: "X", teamBId: "Y", winnerTeamId: "X" }),
    ];
    const standings = computeFinalStandings(["X", "Y"], matches);
    expect(standings).toEqual([
      { position: 1, teamIds: ["X"] },
      { position: 2, teamIds: ["Y"] },
    ]);
  });
});

describe("areAllMatchesDecided", () => {
  it("returns true when every match has a winner or is a bye", () => {
    const matches: Match[] = [
      m({ id: "1", phase: "final", round: 1, teamAId: "A", teamBId: "B", winnerTeamId: "A" }),
      m({ id: "2", phase: "quarter", round: 1, teamAId: "C", teamBId: null, winnerTeamId: "C" }),
    ];
    expect(areAllMatchesDecided(matches)).toBe(true);
  });

  it("returns false if any match still needs a winner", () => {
    const matches: Match[] = [
      m({ id: "1", phase: "final", round: 1, teamAId: "A", teamBId: "B", winnerTeamId: null }),
    ];
    expect(areAllMatchesDecided(matches)).toBe(false);
  });
});
