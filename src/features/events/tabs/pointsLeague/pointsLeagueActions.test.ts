import { describe, expect, it } from "vitest";
import {
  buildNewRound,
  nextRoundNumber,
  planBracketGeneration,
  planBracketReset,
} from "./pointsLeagueActions";
import type { EventFormatConfig, PointsRound, Team } from "@/domain/types";

function team(id: string): Team {
  return { id, eventId: "e1", name: id, participantIds: [id] };
}

function round(roundNumber: number, scores: Record<string, number>): PointsRound {
  return { id: `r${roundNumber}`, eventId: "e1", roundNumber, scores };
}

describe("nextRoundNumber", () => {
  it("retorna 1 si no hi ha cap ronda", () => {
    expect(nextRoundNumber([])).toBe(1);
  });

  it("retorna max(roundNumber) + 1", () => {
    expect(
      nextRoundNumber([round(1, {}), round(2, {}), round(3, {})])
    ).toBe(4);
  });

  it("és resistent a l'ordre d'entrada", () => {
    expect(
      nextRoundNumber([round(3, {}), round(1, {}), round(2, {})])
    ).toBe(4);
  });

  it("no assumeix continuïtat (salts permesos)", () => {
    expect(nextRoundNumber([round(1, {}), round(5, {})])).toBe(6);
  });
});

describe("buildNewRound", () => {
  it("crea una ronda buida amb el roundNumber correcte", () => {
    let nextId = 0;
    const r = buildNewRound({
      eventId: "evt",
      existingRounds: [round(1, { a: 5 })],
      makeId: (n) => `id_${n}_${nextId++}`,
    });
    expect(r).toEqual({
      id: "id_2_0",
      eventId: "evt",
      roundNumber: 2,
      scores: {},
    });
  });

  it("comença per la ronda 1 si no n'hi ha cap", () => {
    const r = buildNewRound({
      eventId: "evt",
      existingRounds: [],
      makeId: () => "fixed-id",
    });
    expect(r.roundNumber).toBe(1);
    expect(r.scores).toEqual({});
  });
});

describe("planBracketGeneration", () => {
  it("passa els top-X com a qualifiers al bracket-maker", () => {
    let n = 0;
    const plan = planBracketGeneration({
      eventId: "e1",
      teams: [team("a"), team("b"), team("c"), team("d")],
      rounds: [round(1, { a: 10, b: 8, c: 6, d: 4 })],
      qualifierCount: 2,
      config: {},
      makeId: () => `m${n++}`,
    });
    expect(plan.qualifiers).toEqual(["a", "b"]);
    // amb 2 qualifiers, la fase inicial és "final"
    expect(plan.matches).toHaveLength(1);
    expect(plan.matches[0].phase).toBe("final");
  });

  it("inclou empats al tall (X=2 amb empat a la 2-3 dóna 3 qualifiers)", () => {
    let n = 0;
    const plan = planBracketGeneration({
      eventId: "e1",
      teams: [team("a"), team("b"), team("c"), team("d")],
      rounds: [round(1, { a: 10, b: 7, c: 7, d: 3 })],
      qualifierCount: 2,
      config: {},
      makeId: () => `m${n++}`,
    });
    expect(plan.qualifiers).toEqual(["a", "b", "c"]);
    // amb 3 qualifiers, hi ha 1 bye → semi
    expect(plan.matches.length).toBeGreaterThan(0);
  });

  it("persisteix bracketQualifiers al nextConfig", () => {
    const plan = planBracketGeneration({
      eventId: "e1",
      teams: [team("a"), team("b"), team("c"), team("d")],
      rounds: [round(1, { a: 10, b: 8, c: 6, d: 4 })],
      qualifierCount: 4,
      config: { individualMode: true },
      makeId: () => "fixed",
    });
    expect(plan.nextConfig).toEqual({
      individualMode: true,
      bracketQualifiers: 4,
    });
  });

  it("llença error si no es poden seleccionar prou classificats", () => {
    expect(() =>
      planBracketGeneration({
        eventId: "e1",
        teams: [team("a")],
        rounds: [round(1, { a: 5 })],
        qualifierCount: 2,
        config: {},
      })
    ).toThrow(/almenys 2/);
  });
});

describe("planBracketReset", () => {
  it("treu bracketQualifiers conservant la resta de camps", () => {
    const next = planBracketReset({
      individualMode: true,
      bracketQualifiers: 8,
      groupSize: 4,
    });
    expect(next).toEqual({ individualMode: true, groupSize: 4 });
  });

  it("no modifica el config original (immutable)", () => {
    const original: EventFormatConfig = { bracketQualifiers: 4 };
    planBracketReset(original);
    expect(original.bracketQualifiers).toBe(4);
  });

  it("és idempotent si bracketQualifiers no hi era", () => {
    expect(planBracketReset({ individualMode: true })).toEqual({
      individualMode: true,
    });
  });
});
