import { describe, expect, it } from "vitest";
import type { Match } from "./types";
import {
  areAllMatchesDecided,
  bracketReachScore,
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

describe("bracketReachScore", () => {
  it("champion reaches final round", () => {
    const matches: Match[] = [
      m({ id: "1", phase: "semi", round: 1, teamAId: "A", teamBId: "B", winnerTeamId: "A" }),
      m({ id: "2", phase: "semi", round: 1, teamAId: "C", teamBId: "D", winnerTeamId: "C" }),
      m({ id: "3", phase: "final", round: 2, teamAId: "A", teamBId: "C", winnerTeamId: "A" }),
    ];
    expect(bracketReachScore("A", matches)).toBe(2);
    expect(bracketReachScore("C", matches)).toBe(1);
    expect(bracketReachScore("B", matches)).toBe(0);
    expect(bracketReachScore("D", matches)).toBe(0);
  });

  it("single_match: winner has score 1, loser 0", () => {
    const matches: Match[] = [
      m({ id: "1", phase: "single", teamAId: "X", teamBId: "Y", winnerTeamId: "Y" }),
    ];
    expect(bracketReachScore("Y", matches)).toBe(1);
    expect(bracketReachScore("X", matches)).toBe(0);
  });

  it("group phase does not count for bracket reach", () => {
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
    expect(bracketReachScore("A", matches)).toBe(0);
  });
});

describe("computeFinalStandings", () => {
  it("bracket with 4 teams produces 1/2/3/3 dense positions", () => {
    const matches: Match[] = [
      m({ id: "1", phase: "semi", round: 1, teamAId: "A", teamBId: "B", winnerTeamId: "A" }),
      m({ id: "2", phase: "semi", round: 1, teamAId: "C", teamBId: "D", winnerTeamId: "C" }),
      m({ id: "3", phase: "final", round: 2, teamAId: "A", teamBId: "C", winnerTeamId: "A" }),
    ];
    const standings = computeFinalStandings(["A", "B", "C", "D"], matches);
    // A=pos1, C=pos2, B & D=pos3 (tied)
    expect(standings[0].position).toBe(1);
    expect(standings[0].teamIds).toEqual(["A"]);
    expect(standings[1].position).toBe(2);
    expect(standings[1].teamIds).toEqual(["C"]);
    expect(standings[2].position).toBe(3);
    expect(standings[2].teamIds.sort()).toEqual(["B", "D"]);
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
