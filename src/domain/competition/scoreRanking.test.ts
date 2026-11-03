import { describe, expect, it } from "vitest";
import {
  computeScoreRankingStandings,
  getSingleScoreRound,
  rankScoreRows,
  teamsWithoutScore,
} from "./scoreRanking";
import type { Team } from "../types";

function team(id: string, participantIds: string[] = [id]): Team {
  return { id, eventId: "e1", name: id, participantIds };
}

const teams = [team("a"), team("b"), team("c"), team("d")];

describe("computeScoreRankingStandings", () => {
  it("ordena descendent per defecte amb empats densos", () => {
    const s = computeScoreRankingStandings(teams, { a: 10, b: 30, c: 30, d: 5 });
    expect(s).toEqual([
      { position: 1, teamIds: ["b", "c"] },
      { position: 2, teamIds: ["a"] },
      { position: 3, teamIds: ["d"] },
    ]);
  });

  it("ordre ascendent: guanya qui té menys (temps)", () => {
    const s = computeScoreRankingStandings(
      teams,
      { a: 42.5, b: 38, c: 51, d: 38 },
      "asc"
    );
    expect(s).toEqual([
      { position: 1, teamIds: ["b", "d"] },
      { position: 2, teamIds: ["a"] },
      { position: 3, teamIds: ["c"] },
    ]);
  });

  it("exclou els competidors sense puntuació i els equips desconeguts", () => {
    const s = computeScoreRankingStandings(teams, { a: 1, c: 2, zz: 99 });
    expect(s).toEqual([
      { position: 1, teamIds: ["c"] },
      { position: 2, teamIds: ["a"] },
    ]);
  });

  it("accepta 0 i negatius com a puntuació vàlida", () => {
    const s = computeScoreRankingStandings(teams, { a: 0, b: -2 });
    expect(s).toEqual([
      { position: 1, teamIds: ["a"] },
      { position: 2, teamIds: ["b"] },
    ]);
  });
});

describe("rankScoreRows", () => {
  it("posa primer els puntuats per posició i després els pendents", () => {
    const rows = rankScoreRows(teams, { c: 3, a: 7 });
    expect(rows).toEqual([
      { teamId: "a", score: 7, position: 1 },
      { teamId: "c", score: 3, position: 2 },
      { teamId: "b", score: null, position: null },
      { teamId: "d", score: null, position: null },
    ]);
  });
});

describe("teamsWithoutScore / getSingleScoreRound", () => {
  it("detecta qui falta per puntuar", () => {
    expect(teamsWithoutScore(teams, { a: 1, d: 0 })).toEqual(["b", "c"]);
  });

  it("retorna la ronda de número més baix o undefined", () => {
    expect(getSingleScoreRound([])).toBeUndefined();
    const r = getSingleScoreRound([
      { id: "r2", eventId: "e1", roundNumber: 2, scores: {} },
      { id: "r1", eventId: "e1", roundNumber: 1, scores: {} },
    ]);
    expect(r?.id).toBe("r1");
  });
});
