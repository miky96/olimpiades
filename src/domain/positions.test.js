import { describe, expect, it } from "vitest";
import { assignDensePositions } from "./positions";
describe("assignDensePositions", () => {
    it("assigna posicions consecutives sense empats", () => {
        const r = assignDensePositions([
            { teamId: "A", score: 10 },
            { teamId: "B", score: 8 },
            { teamId: "C", score: 5 },
        ]);
        expect(r).toEqual([
            { position: 1, teamIds: ["A"] },
            { position: 2, teamIds: ["B"] },
            { position: 3, teamIds: ["C"] },
        ]);
    });
    it("dos empatats a 1a → posició 1 compartida, el següent és 2a (dens)", () => {
        const r = assignDensePositions([
            { teamId: "A", score: 10 },
            { teamId: "B", score: 10 },
            { teamId: "C", score: 9 },
        ]);
        expect(r).toEqual([
            { position: 1, teamIds: ["A", "B"] },
            { position: 2, teamIds: ["C"] },
        ]);
    });
    it("empat triple a 1a → tots tres reben posició 1 i el següent és 2a", () => {
        const r = assignDensePositions([
            { teamId: "A", score: 10 },
            { teamId: "B", score: 10 },
            { teamId: "C", score: 10 },
            { teamId: "D", score: 5 },
        ]);
        expect(r).toEqual([
            { position: 1, teamIds: ["A", "B", "C"] },
            { position: 2, teamIds: ["D"] },
        ]);
    });
    it("gestiona entrada buida", () => {
        expect(assignDensePositions([])).toEqual([]);
    });
});
