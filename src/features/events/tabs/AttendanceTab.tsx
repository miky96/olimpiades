import { useMemo, useState } from "react";
import { Badge, Button, ErrorMessage, Input, Select } from "@/ui/forms";
import { attendanceRepo } from "@/data";
import type { AttendanceStatus, Participant } from "@/domain/types";
import { attendanceLabels, defaultsFor } from "@/domain/attendanceDefaults";
import { useSeasons } from "@/features/seasons/useSeasons";
import type { EventData } from "../EventDetailPage";

interface Props {
  data: EventData;
  readOnly: boolean;
  onChanged: () => Promise<void> | void;
}

interface Row {
  participant: Participant;
  status: AttendanceStatus;
  bonusPoints: number;
  penaltyPoints: number;
  comment: string;
  dirty: boolean;
  saving: boolean;
  error?: string;
}

const STATUS_ORDER: AttendanceStatus[] = [
  "present",
  "late",
  "absent_notified",
  "absent_unnotified",
];

const STATUS_TONES: Record<AttendanceStatus, "emerald" | "amber" | "slate" | "rose"> = {
  present: "emerald",
  late: "amber",
  absent_notified: "slate",
  absent_unnotified: "rose",
};

export function AttendanceTab({ data, readOnly, onChanged }: Props) {
  const { currentSeason } = useSeasons();
  const { event, participants, attendance, teams } = data;
  const seasonId = currentSeason?.id ?? "";
  const editable = !readOnly && event.status !== "finished";

  const eligibleParticipants = useMemo(() => {
    const seen = new Set<string>();
    const list: Participant[] = [];
    for (const p of participants) {
      if (p.active) {
        list.push(p);
        seen.add(p.id);
      }
    }
    for (const a of attendance) {
      if (!seen.has(a.participantId)) {
        const p = participants.find((pp) => pp.id === a.participantId);
        if (p) {
          list.push(p);
          seen.add(p.id);
        }
      }
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [participants, attendance]);

  const initialRows = useMemo<Row[]>(() => {
    const byParticipant = new Map(
      attendance.map((a) => [a.participantId, a] as const)
    );
    return eligibleParticipants.map((p) => {
      const existing = byParticipant.get(p.id);
      const status = existing?.status ?? "present";
      const defaults = defaultsFor(status);
      return {
        participant: p,
        status,
        bonusPoints: existing?.bonusPoints ?? defaults.bonusPoints,
        penaltyPoints: existing?.penaltyPoints ?? defaults.penaltyPoints,
        comment: existing?.comment ?? "",
        dirty: false,
        saving: false,
      };
    });
  }, [attendance, eligibleParticipants]);

  const [rows, setRows] = useState<Row[]>(initialRows);

  const [lastKey, setLastKey] = useState("");
  const currentKey = `${attendance.length}-${eligibleParticipants.length}-${event.id}`;
  if (currentKey !== lastKey) {
    setRows(initialRows);
    setLastKey(currentKey);
  }

  function updateRow(participantId: string, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) =>
        r.participant.id === participantId ? { ...r, ...patch, dirty: true } : r
      )
    );
  }

  function handleStatusChange(participantId: string, status: AttendanceStatus) {
    const defaults = defaultsFor(status);
    setRows((prev) =>
      prev.map((r) => {
        if (r.participant.id !== participantId) return r;
        return {
          ...r,
          status,
          bonusPoints: defaults.bonusPoints,
          penaltyPoints: defaults.penaltyPoints,
          dirty: true,
        };
      })
    );
  }

  async function saveRow(row: Row) {
    if (!editable) return;
    setRows((prev) =>
      prev.map((r) =>
        r.participant.id === row.participant.id
          ? { ...r, saving: true, error: undefined }
          : r
      )
    );
    try {
      await attendanceRepo.upsert(seasonId, event.id, {
        participantId: row.participant.id,
        status: row.status,
        bonusPoints: Number.isFinite(row.bonusPoints) ? row.bonusPoints : 0,
        penaltyPoints: Number.isFinite(row.penaltyPoints) ? row.penaltyPoints : 0,
        comment: row.comment.trim() || undefined,
      });
      setRows((prev) =>
        prev.map((r) =>
          r.participant.id === row.participant.id
            ? { ...r, saving: false, dirty: false }
            : r
        )
      );
      await onChanged();
    } catch (err) {
      console.error(err);
      setRows((prev) =>
        prev.map((r) =>
          r.participant.id === row.participant.id
            ? { ...r, saving: false, error: "No s'ha pogut desar." }
            : r
        )
      );
    }
  }

  async function saveAllDirty() {
    if (!editable) return;
    const dirty = rows.filter((r) => r.dirty && !r.saving);
    for (const r of dirty) {
      // eslint-disable-next-line no-await-in-loop
      await saveRow(r);
    }
  }

  const teamNameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teams) {
      for (const pid of t.participantIds) map.set(pid, t.name);
    }
    return map;
  }, [teams]);

  const dirtyCount = rows.filter((r) => r.dirty).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm muted">
          Marca qui ha vingut i ajusta bonus / penalització. Els valors per defecte
          s'apliquen segons l'estat; pots sobreescriure'ls.
        </p>
        {editable ? (
          <Button onClick={saveAllDirty} disabled={dirtyCount === 0}>
            {dirtyCount > 0
              ? `Desar ${dirtyCount} canvi${dirtyCount === 1 ? "" : "s"}`
              : "Res per desar"}
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="card card-pad text-sm muted">
          No hi ha participants actius en aquesta temporada.
        </p>
      ) : (
        <>
          {/* Mobile: cards per participant */}
          <ul className="space-y-2 md:hidden">
            {rows.map((row) => (
              <li
                key={row.participant.id}
                className={`card p-4 transition-colors ${
                  row.dirty
                    ? "border-amber-300 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/5"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {row.participant.name}
                    </p>
                    <p className="mt-0.5 text-xs subtle">
                      {teamNameOf.get(row.participant.id) ?? "Sense equip"}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONES[row.status]}>
                    {attendanceLabels[row.status]}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-xs font-medium muted">
                    Estat
                    <Select
                      disabled={!editable}
                      value={row.status}
                      onChange={(e) =>
                        handleStatusChange(
                          row.participant.id,
                          e.target.value as AttendanceStatus
                        )
                      }
                      className="mt-1 h-9 py-0 text-sm"
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {attendanceLabels[s]}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="text-xs font-medium muted">
                    Bonus
                    <Input
                      type="number"
                      step={1}
                      disabled={!editable}
                      value={row.bonusPoints}
                      onChange={(e) =>
                        updateRow(row.participant.id, {
                          bonusPoints: Number(e.target.value),
                        })
                      }
                      className="mt-1"
                    />
                  </label>
                  <label className="text-xs font-medium muted">
                    Penalització
                    <Input
                      type="number"
                      step={1}
                      disabled={!editable}
                      value={row.penaltyPoints}
                      onChange={(e) =>
                        updateRow(row.participant.id, {
                          penaltyPoints: Number(e.target.value),
                        })
                      }
                      className="mt-1"
                    />
                  </label>
                  <label className="col-span-2 text-xs font-medium muted">
                    Comentari
                    <Input
                      type="text"
                      disabled={!editable}
                      value={row.comment}
                      onChange={(e) =>
                        updateRow(row.participant.id, { comment: e.target.value })
                      }
                      placeholder="Motiu / nota"
                      className="mt-1"
                    />
                  </label>
                </div>
                {editable ? (
                  <div className="mt-3 flex items-center justify-end gap-2">
                    {row.error ? <ErrorMessage>{row.error}</ErrorMessage> : null}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => saveRow(row)}
                      disabled={!row.dirty || row.saving}
                    >
                      {row.saving ? "Desant…" : "Desar"}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          {/* Desktop: taula */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Participant</th>
                  <th className="px-4 py-3">Equip</th>
                  <th className="px-4 py-3">Estat</th>
                  <th className="px-4 py-3">Bonus</th>
                  <th className="px-4 py-3">Pen.</th>
                  <th className="px-4 py-3">Comentari</th>
                  {editable ? (
                    <th className="px-4 py-3 text-right">Accions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                {rows.map((row) => (
                  <tr
                    key={row.participant.id}
                    className={
                      row.dirty
                        ? "bg-amber-50/70 dark:bg-amber-500/5"
                        : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    }
                  >
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">
                      {row.participant.name}
                    </td>
                    <td className="px-4 py-2 text-xs subtle">
                      {teamNameOf.get(row.participant.id) ?? (
                        <span className="italic">Sense equip</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Select
                        disabled={!editable}
                        value={row.status}
                        onChange={(e) =>
                          handleStatusChange(
                            row.participant.id,
                            e.target.value as AttendanceStatus
                          )
                        }
                        className="h-9 py-0 text-sm"
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {attendanceLabels[s]}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        step={1}
                        disabled={!editable}
                        value={row.bonusPoints}
                        onChange={(e) =>
                          updateRow(row.participant.id, {
                            bonusPoints: Number(e.target.value),
                          })
                        }
                        className="w-20"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        step={1}
                        disabled={!editable}
                        value={row.penaltyPoints}
                        onChange={(e) =>
                          updateRow(row.participant.id, {
                            penaltyPoints: Number(e.target.value),
                          })
                        }
                        className="w-20"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="text"
                        disabled={!editable}
                        value={row.comment}
                        onChange={(e) =>
                          updateRow(row.participant.id, {
                            comment: e.target.value,
                          })
                        }
                        placeholder="Motiu / nota"
                      />
                    </td>
                    {editable ? (
                      <td className="px-4 py-2 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => saveRow(row)}
                          disabled={!row.dirty || row.saving}
                        >
                          {row.saving ? "Desant…" : "Desar"}
                        </Button>
                        {row.error ? (
                          <div className="mt-1">
                            <ErrorMessage>{row.error}</ErrorMessage>
                          </div>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <AttendanceSummary rows={rows} />
    </div>
  );
}

function AttendanceSummary({ rows }: { rows: Row[] }) {
  const counts = STATUS_ORDER.reduce<Record<AttendanceStatus, number>>(
    (acc, s) => ({ ...acc, [s]: 0 }),
    {
      present: 0,
      late: 0,
      absent_notified: 0,
      absent_unnotified: 0,
    }
  );
  for (const r of rows) counts[r.status] += 1;
  return (
    <div className="flex flex-wrap gap-2">
      {STATUS_ORDER.map((s) => (
        <Badge key={s} tone={STATUS_TONES[s]}>
          {attendanceLabels[s]}: <strong className="ml-1">{counts[s]}</strong>
        </Badge>
      ))}
    </div>
  );
}
