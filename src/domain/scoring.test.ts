import { describe, expect, it } from "vitest";
import {
  calculateEventPoints,
  calculateParticipantPoints,
  pointsForPosition,
  sumPointsByParticipant,
} from "./scoring";
import type { AttendanceRecord, FinalStanding, Team } from "./types";

describe("pointsForPosition", () => {
  it("assigna 5/3/1/0 segons la posició", () => {
    expect(pointsForPosition(1)).toBe(5);
    expect(pointsForPosition(2)).toBe(3);
    expect(pointsForPosition(3)).toBe(1);
    expect(pointsForPosition(4)).toBe(0);
    expect(pointsForPosition(99)).toBe(0);
  });
});

describe("calculateParticipantPoints", () => {
  const attendancePresent: AttendanceRecord = {
    id: "a1",
    eventId: "e1",
    participantId: "p1",
    status: "present",
    bonusPoints: 5,
    penaltyPoints: 0,
  };

  it("suma punts de posició + bonus assistència", () => {
    const r = calculateParticipantPoints("p1", 1, attendancePresent);
    expect(r.total).toBe(10); // 5 (1r) + 5 (bonus)
  });

  it("aplica penalització manual quan existeix", () => {
    const withPenalty: AttendanceRecord = {
      ...attendancePresent,
      status: "late",
      penaltyPoints: -1,
    };
    const r = calculateParticipantPoints("p1", 2, withPenalty);
    expect(r.total).toBe(3 + 5 - 1); // 7
  });

  it("sense registre d'assistència, només compten els punts de posició", () => {
    const r = calculateParticipantPoints("p1", 1, undefined);
    expect(r.total).toBe(5);
  });

  it("un no assistent penalitzat perd punts sense rebre bonus", () => {
    const absent: AttendanceRecord = {
      id: "a2",
      eventId: "e1",
      participantId: "p1",
      status: "absent_unnotified",
      bonusPoints: 0,
      penaltyPoints: -3,
    };
    const r = calculateParticipantPoints("p1", 99, absent);
    expect(r.total).toBe(-3);
  });
});

describe("calculateEventPoints", () => {
  const teams: Team[] = [
    { id: "tA", eventId: "e1", name: "A", participantIds: ["p1", "p2"] },
    { id: "tB", eventId: "e1", name: "B", participantIds: ["p3", "p4"] },
  ];

  const attendance: Record<string, AttendanceRecord> = {
    p1: {
      id: "a1",
      eventId: "e1",
      participantId: "p1",
      status: "present",
      bonusPoints: 5,
      penaltyPoints: 0,
    },
    p2: {
      id: "a2",
      eventId: "e1",
      participantId: "p2",
      status: "late",
      bonusPoints: 5,
      penaltyPoints: -1,
    },
    p3: {
      id: "a3",
      eventId: "e1",
      participantId: "p3",
      status: "present",
      bonusPoints: 5,
      penaltyPoints: 0,
    },
    p4: {
      id: "a4",
      eventId: "e1",
      participantId: "p4",
      status: "absent_unnotified",
      bonusPoints: 0,
      penaltyPoints: -3,
    },
  };

  it("assigna els punts de posició a cada membre de l'equip", () => {
    const standings: FinalStanding[] = [
      { position: 1, teamIds: ["tA"] },
      { position: 2, teamIds: ["tB"] },
    ];
    const breakdowns = calculateEventPoints(standings, teams, attendance);
    const totals = sumPointsByParticipant(breakdowns);
    expect(totals["p1"]).toBe(5 + 5); // 1r + present
    expect(totals["p2"]).toBe(5 + 5 - 1); // 1r + present + late
    expect(totals["p3"]).toBe(3 + 5); // 2n + present
    expect(totals["p4"]).toBe(3 + 0 - 3); // 2n + absent unnotified
  });

  it("amb empat a 1a, tots dos equips reben 5 punts per posició", () => {
    const standings: FinalStanding[] = [
      { position: 1, teamIds: ["tA", "tB"] },
    ];
    const breakdowns = calculateEventPoints(standings, teams, attendance);
    const totals = sumPointsByParticipant(breakdowns);
    expect(totals["p1"]).toBe(5 + 5);
    expect(totals["p3"]).toBe(5 + 5);
  });
});
