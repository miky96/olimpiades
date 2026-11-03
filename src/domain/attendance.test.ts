import { describe, expect, it } from "vitest";
import {
  computeMissingAttendanceDefaults,
  isMarkedAbsent,
  selectAttendingParticipants,
  selectPresentParticipants,
} from "./attendance";
import type { AttendanceRecord, Participant } from "./types";

function p(id: string, active = true): Participant {
  return { id, seasonId: "s1", name: id.toUpperCase(), active };
}

function a(
  participantId: string,
  overrides: Partial<AttendanceRecord> = {}
): AttendanceRecord {
  return {
    id: participantId,
    eventId: "e1",
    participantId,
    status: "present",
    bonusPoints: 5,
    penaltyPoints: 0,
    ...overrides,
  };
}

describe("computeMissingAttendanceDefaults", () => {
  it("retorna un registre per defecte per a cada participant actiu sense registre", () => {
    const result = computeMissingAttendanceDefaults({
      eventId: "e1",
      participants: [p("alice"), p("bob")],
      existing: [],
    });

    expect(result).toHaveLength(2);
    for (const r of result) {
      expect(r.eventId).toBe("e1");
      expect(r.status).toBe("present");
      expect(r.bonusPoints).toBe(5);
      expect(r.penaltyPoints).toBe(0);
    }
    expect(result.map((r) => r.participantId).sort()).toEqual(["alice", "bob"]);
  });

  it("omet participants que ja tenen registre, encara que sigui amb estat diferent", () => {
    const result = computeMissingAttendanceDefaults({
      eventId: "e1",
      participants: [p("alice"), p("bob"), p("carol")],
      existing: [a("bob", { status: "absent_unnotified", bonusPoints: 0, penaltyPoints: -3 })],
    });

    expect(result.map((r) => r.participantId).sort()).toEqual(["alice", "carol"]);
  });

  it("omet participants inactius sense registre (no els força a venir)", () => {
    const result = computeMissingAttendanceDefaults({
      eventId: "e1",
      participants: [p("alice"), p("inactive", false)],
      existing: [],
    });

    expect(result.map((r) => r.participantId)).toEqual(["alice"]);
  });

  it("respecta inactius que SÍ que tenen registre previ (van venir puntualment)", () => {
    const result = computeMissingAttendanceDefaults({
      eventId: "e1",
      participants: [p("active1"), p("inactiveWithRecord", false)],
      existing: [a("inactiveWithRecord")],
    });

    // Ni es toca el registre existent ni es crea un per a inactiveWithRecord.
    expect(result.map((r) => r.participantId)).toEqual(["active1"]);
  });

  it("retorna llista buida si no hi ha res pendent", () => {
    const result = computeMissingAttendanceDefaults({
      eventId: "e1",
      participants: [p("alice")],
      existing: [a("alice")],
    });

    expect(result).toEqual([]);
  });
});

describe("selectPresentParticipants", () => {
  it("inclou actius sense registre (default present)", () => {
    const result = selectPresentParticipants(
      [p("alice"), p("bob")],
      []
    );
    expect(result.map((x) => x.id).sort()).toEqual(["alice", "bob"]);
  });

  it("exclou inactius sense registre", () => {
    const result = selectPresentParticipants(
      [p("alice"), p("ghost", false)],
      []
    );
    expect(result.map((x) => x.id)).toEqual(["alice"]);
  });

  it("inclou inactius amb registre present (van venir puntualment)", () => {
    const result = selectPresentParticipants(
      [p("alice"), p("returnee", false)],
      [a("returnee", { status: "present" })]
    );
    expect(result.map((x) => x.id).sort()).toEqual(["alice", "returnee"]);
  });

  it("exclou actius amb registre absent o late", () => {
    const result = selectPresentParticipants(
      [p("alice"), p("late"), p("absent")],
      [
        a("late", { status: "late" }),
        a("absent", { status: "absent_notified" }),
      ]
    );
    expect(result.map((x) => x.id)).toEqual(["alice"]);
  });
});

describe("selectAttendingParticipants / isMarkedAbsent", () => {
  const people = [
    { id: "pr", seasonId: "s", name: "pr", active: true },
    { id: "lt", seasonId: "s", name: "lt", active: true },
    { id: "ab", seasonId: "s", name: "ab", active: true },
    { id: "nr", seasonId: "s", name: "nr", active: true },
  ];
  const rec = (participantId: string, status: AttendanceRecord["status"]) => ({
    id: participantId,
    eventId: "e",
    participantId,
    status,
    bonusPoints: 0,
    penaltyPoints: 0,
  });
  const att = [rec("pr", "present"), rec("lt", "late"), rec("ab", "absent_unnotified")];

  it("inclou presents, arribats tard i actius sense registre", () => {
    expect(selectAttendingParticipants(people, att).map((p) => p.id)).toEqual([
      "pr",
      "lt",
      "nr",
    ]);
  });

  it("detecta absents", () => {
    expect(isMarkedAbsent("ab", att)).toBe(true);
    expect(isMarkedAbsent("lt", att)).toBe(false);
    expect(isMarkedAbsent("nr", att)).toBe(false);
  });
});
