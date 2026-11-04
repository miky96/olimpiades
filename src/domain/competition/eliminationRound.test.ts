import { describe, expect, it } from "vitest";
import {
  getEliminationState,
  planDeclareWinner,
  planElimination,
  planUndo,
} from "./eliminationRound";
import type { PointsRound } from "../types";

function round(scores: Record<string, number>): PointsRound {
  return { id: "r1", eventId: "e1", roundNumber: 1, scores };
}

const PLAYERS = ["a", "b", "c", "d"];

describe("eliminationRound", () => {
  it("el primer eliminat queda últim", () => {
    const state = getEliminationState(round({}), PLAYERS);
    expect(state.alive).toEqual(PLAYERS);
    expect(planElimination(state, ["c"])).toEqual({ c: 4 });
  });

  it("amb dos vius, eliminar-ne un dona la victòria a l'altre", () => {
    const state = getEliminationState(round({ c: 4, a: 3 }), PLAYERS);
    expect(state.alive).toEqual(["b", "d"]);
    expect(planElimination(state, ["d"])).toEqual({ d: 2, b: 1 });
  });

  it("eliminats alhora comparteixen la millor posició", () => {
    const state = getEliminationState(round({}), PLAYERS);
    expect(planElimination(state, ["a", "b"])).toEqual({ a: 3, b: 3 });
  });

  it("final empatada: tots els vius comparteixen el 1r", () => {
    const state = getEliminationState(round({ a: 4, b: 3 }), PLAYERS);
    expect(planElimination(state, ["c", "d"])).toEqual({ c: 1, d: 1 });
  });

  it("els que no juguen no compten per a les posicions", () => {
    const state = getEliminationState(round({}), ["a", "b", "c"]);
    expect(planElimination(state, ["a"])).toEqual({ a: 3 });
  });

  it("no permet eliminar algú que ja té posició", () => {
    const state = getEliminationState(round({ a: 4 }), PLAYERS);
    expect(() => planElimination(state, ["a"])).toThrow();
  });

  it("desfer treu l'últim grup eliminat", () => {
    const state = getEliminationState(round({ a: 4, b: 3, c: 3 }), PLAYERS);
    expect(planUndo(state)).toEqual(["b", "c"]);
    expect(planUndo(getEliminationState(round({}), PLAYERS))).toEqual([]);
  });

  it("desfer després d'acabar treu primer el guanyador", () => {
    const state = getEliminationState(
      round({ a: 4, b: 3, c: 2, d: 1 }),
      PLAYERS
    );
    expect(planUndo(state)).toEqual(["d"]);
    const after = getEliminationState(round({ a: 4, b: 3, c: 2 }), PLAYERS);
    expect(planDeclareWinner(after)).toEqual({ d: 1 });
  });
});
