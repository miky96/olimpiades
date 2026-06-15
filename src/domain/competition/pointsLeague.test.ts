import { describe, expect, it } from "vitest";
import {
  computePointsLeagueFinalStandings,
  computePointsLeagueStandings,
  selectTopQualifiers,
} from "./pointsLeague";
import type { Match, PointsRound, Team } from "../types";

/** Helpers per construir fixtures llegibles als tests. */
function team(id: string, name = id): Team {
  return { id, eventId: "e1", name, participantIds: [id] };
}

function round(
  id: string,
  roundNumber: number,
  scores: Record<string, number>
): PointsRound {
  return { id, eventId: "e1", roundNumber, scores };
}

function bracketMatch(opts: {
  id: string;
  phase: Match["phase"];
  round: number;
  a: string;
  b: string | null;
  winner: string | null;
}): Match {
  return {
    id: opts.id,
    eventId: "e1",
    phase: opts.phase,
    round: opts.round,
    teamAId: opts.a,
    teamBId: opts.b,
    winnerTeamId: opts.winner,
  };
}

describe("computePointsLeagueStandings", () => {
  it("suma els punts de totes les rondes per participant", () => {
    const teams = [team("a"), team("b"), team("c")];
    const rounds = [
      round("r1", 1, { a: 10, b: 8, c: 6 }),
      round("r2", 2, { a: 7, b: 9, c: 5 }),
    ];
    const standings = computePointsLeagueStandings(teams, rounds);
    expect(standings).toEqual([
      { teamId: "a", total: 17, roundsScored: 2 },
      { teamId: "b", total: 17, roundsScored: 2 },
      { teamId: "c", total: 11, roundsScored: 2 },
    ]);
  });

  it("inclou participants sense cap puntuació (total 0)", () => {
    const teams = [team("a"), team("b")];
    const rounds = [round("r1", 1, { a: 5 })];
    const standings = computePointsLeagueStandings(teams, rounds);
    expect(standings.map((s) => s.teamId)).toEqual(["a", "b"]);
    expect(standings.find((s) => s.teamId === "b")).toEqual({
      teamId: "b",
      total: 0,
      roundsScored: 0,
    });
  });

  it("ordena els empats per teamId (estable)", () => {
    const teams = [team("c"), team("b"), team("a")];
    const rounds = [round("r1", 1, { a: 5, b: 5, c: 5 })];
    const standings = computePointsLeagueStandings(teams, rounds);
    expect(standings.map((s) => s.teamId)).toEqual(["a", "b", "c"]);
  });

  it("ignora scores de teamIds desconeguts (defensiu)", () => {
    const teams = [team("a")];
    const rounds = [round("r1", 1, { a: 10, ghost: 999 })];
    const standings = computePointsLeagueStandings(teams, rounds);
    expect(standings).toEqual([
      { teamId: "a", total: 10, roundsScored: 1 },
    ]);
  });

  it("accepta puntuacions negatives o decimals", () => {
    const teams = [team("a"), team("b")];
    const rounds = [
      round("r1", 1, { a: 1.5, b: -2 }),
      round("r2", 2, { a: -3, b: 4.5 }),
    ];
    const standings = computePointsLeagueStandings(teams, rounds);
    expect(standings[0]).toEqual({
      teamId: "b",
      total: 2.5,
      roundsScored: 2,
    });
    expect(standings[1]).toEqual({
      teamId: "a",
      total: -1.5,
      roundsScored: 2,
    });
  });
});

describe("selectTopQualifiers", () => {
  it("retorna els N primers quan no hi ha empat al tall", () => {
    const standings = computePointsLeagueStandings(
      [team("a"), team("b"), team("c"), team("d")],
      [round("r1", 1, { a: 10, b: 8, c: 6, d: 4 })]
    );
    expect(selectTopQualifiers(standings, 2)).toEqual(["a", "b"]);
  });

  it("inclou tots els empatats si el tall cau dins un grup d'empat", () => {
    const standings = computePointsLeagueStandings(
      [team("a"), team("b"), team("c"), team("d")],
      // b i c empaten a la posició 2-3; si X=2 inclourem c també (i serien 3)
      [round("r1", 1, { a: 10, b: 7, c: 7, d: 3 })]
    );
    expect(selectTopQualifiers(standings, 2)).toEqual(["a", "b", "c"]);
  });

  it("retorna tots els participants si X >= total", () => {
    const standings = computePointsLeagueStandings(
      [team("a"), team("b")],
      [round("r1", 1, { a: 5, b: 3 })]
    );
    expect(selectTopQualifiers(standings, 10)).toEqual(["a", "b"]);
  });

  it("retorna llista buida si X <= 0", () => {
    const standings = computePointsLeagueStandings(
      [team("a")],
      [round("r1", 1, { a: 5 })]
    );
    expect(selectTopQualifiers(standings, 0)).toEqual([]);
    expect(selectTopQualifiers(standings, -1)).toEqual([]);
  });
});

describe("computePointsLeagueFinalStandings", () => {
  it("sense bracket: usa el total de punts amb empats densos", () => {
    const teams = [team("a"), team("b"), team("c"), team("d")];
    const rounds = [round("r1", 1, { a: 10, b: 8, c: 8, d: 5 })];
    const standings = computePointsLeagueFinalStandings(teams, rounds, []);
    expect(standings).toEqual([
      { position: 1, teamIds: ["a"] },
      { position: 2, teamIds: ["b", "c"] },
      { position: 3, teamIds: ["d"] },
    ]);
  });

  it("amb bracket: els classificats prenen posicions del bracket", () => {
    const teams = [team("a"), team("b"), team("c"), team("d")];
    const rounds = [round("r1", 1, { a: 10, b: 9, c: 8, d: 7 })];
    // Bracket de 4 amb a/b/c/d. a i b a la final, a guanya. c/d a 3r lloc, c guanya.
    const matches: Match[] = [
      bracketMatch({
        id: "m1",
        phase: "semi",
        round: 1,
        a: "a",
        b: "c",
        winner: "a",
      }),
      bracketMatch({
        id: "m2",
        phase: "semi",
        round: 1,
        a: "b",
        b: "d",
        winner: "b",
      }),
      bracketMatch({
        id: "m3",
        phase: "final",
        round: 2,
        a: "a",
        b: "b",
        winner: "a",
      }),
      bracketMatch({
        id: "m4",
        phase: "third_place",
        round: 2,
        a: "c",
        b: "d",
        winner: "c",
      }),
    ];
    const standings = computePointsLeagueFinalStandings(teams, rounds, matches);
    // L'ordre final ha de venir del bracket, no del total de punts.
    expect(standings).toEqual([
      { position: 1, teamIds: ["a"] },
      { position: 2, teamIds: ["b"] },
      { position: 3, teamIds: ["c"] },
      { position: 4, teamIds: ["d"] },
    ]);
  });

  it("amb bracket: els no-classificats queden darrere, ordenats per total", () => {
    const teams = [team("a"), team("b"), team("c"), team("d"), team("e")];
    // Top 2 (a, b) van a la final. c/d/e queden fora; els seus punts decideixen l'ordre.
    const rounds = [round("r1", 1, { a: 10, b: 9, c: 6, d: 8, e: 4 })];
    const matches: Match[] = [
      bracketMatch({
        id: "m1",
        phase: "final",
        round: 1,
        a: "a",
        b: "b",
        winner: "b",
      }),
    ];
    const standings = computePointsLeagueFinalStandings(teams, rounds, matches);
    expect(standings).toEqual([
      { position: 1, teamIds: ["b"] },
      { position: 2, teamIds: ["a"] },
      // d (8) > c (6) > e (4) entre els no-classificats
      { position: 3, teamIds: ["d"] },
      { position: 4, teamIds: ["c"] },
      { position: 5, teamIds: ["e"] },
    ]);
  });

  it("els no-classificats sempre queden darrere de qualsevol del bracket, encara amb molts punts", () => {
    // Cas patològic: un participant amb molts punts queda fora del bracket
    // (potser per haver-hi un X petit i empats), però l'ordenació final ha
    // de respectar que el bracket val més que la classificació de punts.
    const teams = [team("a"), team("b"), team("c")];
    const rounds = [round("r1", 1, { a: 1, b: 1, c: 999 })];
    // Només a i b al bracket; c queda fora amb 999 punts. La final entre a/b.
    const matches: Match[] = [
      bracketMatch({
        id: "m1",
        phase: "final",
        round: 1,
        a: "a",
        b: "b",
        winner: "a",
      }),
    ];
    const standings = computePointsLeagueFinalStandings(teams, rounds, matches);
    expect(standings).toEqual([
      { position: 1, teamIds: ["a"] },
      { position: 2, teamIds: ["b"] },
      { position: 3, teamIds: ["c"] }, // últim malgrat els 999 punts
    ]);
  });
});
