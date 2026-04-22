import { useMemo, useState } from "react";
import { Button, ErrorMessage, Input } from "@/ui/forms";
import { attendanceRepo } from "@/data";
import type { AttendanceStatus, Participant } from "@/domain/types";
import { attendanceLabels, defaultsFor } from "@/domain/attendanceDefaults";
import { useSeasons } from "@/features/seasons/SeasonContext";
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

export function AttendanceTab({ data, readOnly, onChanged }: Props) {
  const { currentSeason } = useSeasons();
  const { event, participants, attendance, teams } = data;
  const seasonId = currentSeason?.id ?? "";
  const editable = !readOnly && event.status !== "finished";

  // Participants que juguen: actius + els que ja tenen assistència (per si un inactiu va venir).
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

  // Re-sync quan canvien les dades externes.
  const [lastKey, setLastKey] = useState("");
  const currentKey = `${attendance.length}-${eligibleParticipants.length}-${event.id}`;
  if (currentKey !== lastKey) {
    setRows(initialRows);
    setLastKey(currentKey);
  }

  function updateRow(participantId: string, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) =>
        r.participant.id === participantId
          ? { ...r, ...patch, dirty: true }
          : r
      )
    );
  }

  function handleStatusChange(participantId: string, status: AttendanceStatus) {
    const defaults = defaultsFor(status);
    setRows((prev) =>
      prev.map((r) => {
        if (r.participant.id !== participantId) return r;
        // Aplica els valors per defecte, però només si l'usuari no els ha tocat.
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
      // Desat seqüencial per simplicitat i evitar càrregues massives.
      // Si el nombre creix, passar a Promise.all.
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
        <p className="text-sm text-slate-600">
          Marca qui ha vingut i ajusta bonus / penalització. Els valors per defecte
          s'apliquen segons l'estat seleccionat; pots sobreescriure'ls. Els
          participants que no estan en cap equip també apareixen i es poden
          penalitzar (p. ex. no han vingut tot i dir que venien).
        </p>
        {editable ? (
          <Button onClick={saveAllDirty} disabled={dirtyCount === 0}>
            {dirtyCount > 0 ? `Desar ${dirtyCount} canvi${dirtyCount === 1 ? "" : "s"}` : "Res per desar"}
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No hi ha participants actius en aquesta temporada.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-600">
              <tr>
                <th className="px-4 py-2">Participant</th>
                <th className="px-4 py-2">Equip</th>
                <th className="px-4 py-2">Estat</th>
                <th className="px-4 py-2">Bonus</th>
                <th className="px-4 py-2">Penalització</th>
                <th className="px-4 py-2">Comentari</th>
                {editable ? <th className="px-4 py-2 text-right">Accions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.participant.id} className={row.dirty ? "bg-amber-50" : ""}>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {row.participant.name}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {teamNameOf.get(row.participant.id) ?? (
                      <span className="italic text-slate-400">Sense equip</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      disabled={!editable}
                      value={row.status}
                      onChange={(e) =>
                        handleStatusChange(
                          row.participant.id,
                          e.target.value as AttendanceStatus
                        )
                      }
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50"
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {attendanceLabels[s]}
                        </option>
                      ))}
                    </select>
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
                        updateRow(row.participant.id, { comment: e.target.value })
                      }
                      placeholder="Motiu / nota"
                    />
                  </td>
                  {editable ? (
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="secondary"
                        onClick={() => saveRow(row)}
                        disabled={!row.dirty || row.saving}
                      >
                        {row.saving ? "Desant…" : "Desar"}
                      </Button>
                      {row.error ? (
                        <div className="mt-1"><ErrorMessage>{row.error}</ErrorMessage></div>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
      {STATUS_ORDER.map((s) => (
        <span key={s} className="rounded-full bg-slate-100 px-3 py-1">
          {attendanceLabels[s]}: <strong>{counts[s]}</strong>
        </span>
      ))}
    </div>
  );
}
