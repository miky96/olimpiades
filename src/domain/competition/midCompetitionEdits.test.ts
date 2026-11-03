import { describe, expect, it } from "vitest";
import {
  assignedParticipantIds,
  canAddCompetitorMidway,
  canEditTeamMembers,
  canRemoveCompetitorMidway,
  currentRotatingTeamIds,
  retargetUndecidedMatches,
  teamNeedsFork,
} from "./midCompetitionEdits";
import type { EventFormat, EventStatus, Match, Team } from "../types";

function ev(
  format: EventFormat,
  status: EventStatus = "in_progress",
  individualMode = false
) {
  return { format, status, config: { individualMode } };
}

function team(id: string, participantIds: string[]): Team {
  return { id, eventId: "e1", name: id, participantIds };
}

function rot(id: string, round: number, a: string, b: string, winner: string | null): Match {
  return {
    id,
    eventId: "e1",
    phase: "rotating",
    round,
    teamAId: a,
    teamBId: b,
    winnerTeamId: winner,
  };
}

const tA = team("tA", ["p1", "p2"]);
const tB = team("tB", ["p3", "p4"]);
const tC = team("tC", ["p1", "p3"]);

describe("canEditTeamMembers", () => {
  it("sempre en esborrany, mai finalitzat", () => {
    expect(canEditTeamMembers(ev("bracket", "draft"), tA, [])).toBe(true);
    expect(canEditTeamMembers(ev("bracket", "finished"), tA, [])).toBe(false);
  });

  it("formats per equips en curs: sí", () => {
    expect(canEditTeamMembers(ev("group_stage_bracket"), tA, [])).toBe(true);
    expect(canEditTeamMembers(ev("score_ranking"), tA, [])).toBe(true);
  });

  it("mode individual en curs: no", () => {
    expect(canEditTeamMembers(ev("league_only", "in_progress", true), tA, [])).toBe(false);
    expect(canEditTeamMembers(ev("points_league_bracket"), tA, [])).toBe(false);
  });

  it("rotatiu: només equips del partit en curs", () => {
    const matches = [rot("m1", 1, "tA", "tB", "tA"), rot("m2", 2, "tC", "tB", null)];
    expect(canEditTeamMembers(ev("rotating_singles"), tA, matches)).toBe(false);
    expect(canEditTeamMembers(ev("rotating_singles"), tB, matches)).toBe(true);
    expect(canEditTeamMembers(ev("rotating_singles"), tC, matches)).toBe(true);
  });
});

describe("teamNeedsFork / retargetUndecidedMatches", () => {
  const matches = [rot("m1", 1, "tA", "tB", "tA"), rot("m2", 2, "tA", "tB", null)];

  it("cal bifurcar un equip rotatiu amb partits decidits", () => {
    expect(teamNeedsFork(ev("rotating_singles"), tA, matches)).toBe(true);
    expect(teamNeedsFork(ev("rotating_singles"), tC, matches)).toBe(false);
    expect(teamNeedsFork(ev("bracket"), tA, matches)).toBe(false);
  });

  it("només reapunta partits sense guanyador", () => {
    const out = retargetUndecidedMatches(matches, "tA", "tA2");
    expect(out).toEqual([{ ...matches[1], teamAId: "tA2" }]);
  });
});

describe("competidors individuals a mitja prova", () => {
  it("només formats per puntuació en mode individual i en curs", () => {
    expect(canAddCompetitorMidway(ev("points_league_bracket"))).toBe(true);
    expect(canAddCompetitorMidway(ev("score_ranking", "in_progress", true))).toBe(true);
    expect(canAddCompetitorMidway(ev("score_ranking"))).toBe(false);
    expect(canAddCompetitorMidway(ev("league_only", "in_progress", true))).toBe(false);
    expect(canAddCompetitorMidway(ev("points_league_bracket", "draft"))).toBe(false);
  });

  it("no es pot treure qui ja és al bracket", () => {
    const solo = team("s1", ["p1"]);
    const m: Match = {
      id: "b1",
      eventId: "e1",
      phase: "final",
      round: 1,
      teamAId: "s1",
      teamBId: "s2",
      winnerTeamId: null,
    };
    expect(canRemoveCompetitorMidway(ev("points_league_bracket"), solo, [])).toBe(true);
    expect(canRemoveCompetitorMidway(ev("points_league_bracket"), solo, [m])).toBe(false);
  });
});

describe("assignedParticipantIds", () => {
  it("en rotatiu en curs només compta el partit actual", () => {
    const matches = [rot("m1", 1, "tA", "tB", "tA"), rot("m2", 2, "tC", "tB", null)];
    const ids = assignedParticipantIds(ev("rotating_singles"), [tA, tB, tC], matches);
    expect([...ids].sort()).toEqual(["p1", "p3", "p4"]);
    expect([...currentRotatingTeamIds(matches)].sort()).toEqual(["tB", "tC"]);
  });

  it("altres formats: tots els equips", () => {
    const ids = assignedParticipantIds(ev("bracket"), [tA, tB], []);
    expect([...ids].sort()).toEqual(["p1", "p2", "p3", "p4"]);
  });
});
