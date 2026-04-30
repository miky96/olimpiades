import { useMemo, useState } from "react";
import { Badge, Button, ErrorMessage, Input } from "@/ui/forms";
import { attendanceRepo } from "@/data";
import type {
  AttendanceRecord,
  AttendanceStatus,
  Participant,
} from "@/domain/types";
import { attendanceLabels, defaultsFor } from "@/domain/attendanceDefaults";
import { useSeasons } from "@/features/seasons/useSeasons";
import type { EventData } from "../EventDetailPage";
import { AttendanceRow } from "./attendance/AttendanceRow";
import { AttendanceSection } from "./attendance/AttendanceSection";
import { AttendanceBulkBar } from "./attendance/AttendanceBulkBar";
import { AttendanceDetailDialog } from "./attendance/AttendanceDetailDialog";
import {
  STATUS_ORDER,
  STATUS_TONES,
  type AttendanceRow as Row,
} from "./attendance/types";

interface Props {
  data: EventData;
  readOnly: boolean;
  onChanged: () => Promise<void> | void;
}

/**
 * Pestanya d'assistència optimitzada per a registre massiu (desenes/centenars
 * de participants). Patró d'ús esperat:
 *
 *  1. Tothom comença com a "Present" per defecte (és la majoria de casos).
 *  2. L'admin selecciona els que falten/arriben tard/etc. tocant múltiples
 *     files d'un cop.
 *  3. Aplica una acció massiva des de la barra inferior (p.ex. "Tard").
 *  4. Si cal sobreescriure bonus/penalització/comentari per algú concret,
 *     obre "Detalls" en aquella fila.
 *  5. Desa tot d'un cop (writeBatch a Firestore).
 *
 * Disseny en una sola vista (no separa mòbil/desktop): la llista compacta
 * amb seccions plegables funciona bé en ambdós.
 */
export function AttendanceTab({ data, readOnly, onChanged }: Props) {
  const { currentSeason } = useSeasons();
  const { event, participants, attendance, teams } = data;
  const seasonId = currentSeason?.id ?? "";
  const editable = !readOnly && event.status !== "finished";

  const eligibleParticipants = useMemo(
    () => computeEligibleParticipants(participants, attendance),
    [participants, attendance]
  );

  const initialRows = useMemo<Row[]>(
    () => buildInitialRows(eligibleParticipants, attendance),
    [eligibleParticipants, attendance]
  );

  const [rows, setRows] = useState<Row[]>(initialRows);
  const [lastKey, setLastKey] = useState("");
  // Re-sync amb dades remotes quan canvien (mateix patró que abans).
  const currentKey = `${attendance.length}-${eligibleParticipants.length}-${event.id}`;
  if (currentKey !== lastKey) {
    setRows(initialRows);
    setLastKey(currentKey);
  }

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<AttendanceStatus>>(new Set());
  const [search, setSearch] = useState("");
  const [detailParticipantId, setDetailParticipantId] = useState<string | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const teamNameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teams) for (const pid of t.participantIds) map.set(pid, t.name);
    return map;
  }, [teams]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.participant.name.toLowerCase().includes(q));
  }, [rows, search]);

  const rowsByStatus = useMemo(() => {
    const m: Record<AttendanceStatus, Row[]> = {
      present: [],
      late: [],
      absent_notified: [],
      absent_unnotified: [],
    };
    for (const r of filteredRows) m[r.status].push(r);
    return m;
  }, [filteredRows]);

  const dirtyCount = rows.filter((r) => r.dirty).length;

  function toggleSelected(participantId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) next.delete(participantId);
      else next.add(participantId);
      return next;
    });
  }

  function toggleSelectAllInSection(status: AttendanceStatus) {
    const ids = rowsByStatus[status].map((r) => r.participant.id);
    setSelected((prev) => {
      const next = new Set(prev);
      const allIn = ids.every((id) => next.has(id));
      if (allIn) for (const id of ids) next.delete(id);
      else for (const id of ids) next.add(id);
      return next;
    });
  }

  function toggleCollapsed(status: AttendanceStatus) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function applyStatusToSelection(status: AttendanceStatus) {
    if (!editable || selected.size === 0) return;
    const d = defaultsFor(status);
    setRows((prev) =>
      prev.map((r) =>
        selected.has(r.participant.id)
          ? {
              ...r,
              status,
              bonusPoints: d.bonusPoints,
              penaltyPoints: d.penaltyPoints,
              dirty: true,
            }
          : r
      )
    );
    setSelected(new Set());
  }

  function applyDetailOverride(
    participantId: string,
    patch: {
      status: AttendanceStatus;
      bonusPoints: number;
      penaltyPoints: number;
      comment: string;
    }
  ) {
    setRows((prev) =>
      prev.map((r) =>
        r.participant.id === participantId
          ? { ...r, ...patch, dirty: true }
          : r
      )
    );
    setDetailParticipantId(null);
  }

  function resetAllToPresent() {
    if (!editable) return;
    const d = defaultsFor("present");
    setRows((prev) =>
      prev.map((r) =>
        r.status === "present" &&
        r.bonusPoints === d.bonusPoints &&
        r.penaltyPoints === d.penaltyPoints &&
        r.comment === ""
          ? r
          : {
              ...r,
              status: "present",
              bonusPoints: d.bonusPoints,
              penaltyPoints: d.penaltyPoints,
              comment: "",
              dirty: true,
            }
      )
    );
    setSelected(new Set());
  }

  async function saveAll() {
    if (!editable || dirtyCount === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const dirty = rows.filter((r) => r.dirty);
      await attendanceRepo.upsertMany(
        seasonId,
        event.id,
        dirty.map((r) => ({
          participantId: r.participant.id,
          status: r.status,
          bonusPoints: Number.isFinite(r.bonusPoints) ? r.bonusPoints : 0,
          penaltyPoints: Number.isFinite(r.penaltyPoints) ? r.penaltyPoints : 0,
          comment: r.comment.trim() || undefined,
        }))
      );
      setRows((prev) => prev.map((r) => (r.dirty ? { ...r, dirty: false } : r)));
      await onChanged();
    } catch (err) {
      console.error(err);
      setSaveError("No s'ha pogut desar. Torna-ho a provar.");
    } finally {
      setSaving(false);
    }
  }

  const detailRow = detailParticipantId
    ? rows.find((r) => r.participant.id === detailParticipantId) ?? null
    : null;

  const totalCounts = useMemo(() => countByStatus(rows), [rows]);

  return (
    <div className="space-y-4">
      <Header
        editable={editable}
        dirtyCount={dirtyCount}
        saving={saving}
        search={search}
        onSearchChange={setSearch}
        onSave={saveAll}
        onResetAll={resetAllToPresent}
        totalCounts={totalCounts}
      />

      {saveError ? <ErrorMessage>{saveError}</ErrorMessage> : null}

      {rows.length === 0 ? (
        <p className="card card-pad text-sm muted">
          No hi ha participants actius en aquesta temporada.
        </p>
      ) : (
        <div className="space-y-3">
          {STATUS_ORDER.map((status) => {
            const sectionRows = rowsByStatus[status];
            // Si s'està filtrant i una secció queda buida, l'amaguem per
            // evitar soroll visual. Si no hi ha filtre, mostrem-la (encara
            // que estigui buida) perquè el target de drop massiu és visible.
            if (search && sectionRows.length === 0) return null;
            const sectionSelectedCount = sectionRows.reduce(
              (acc, r) => acc + (selected.has(r.participant.id) ? 1 : 0),
              0
            );
            return (
              <AttendanceSection
                key={status}
                status={status}
                count={sectionRows.length}
                collapsed={collapsed.has(status)}
                selectedCount={sectionSelectedCount}
                totalSelectable={sectionRows.length}
                onToggleCollapsed={() => toggleCollapsed(status)}
                onToggleSelectAll={() => toggleSelectAllInSection(status)}
                selectable={editable}
              >
                {sectionRows.length === 0 ? (
                  <li className="px-3 py-3 text-xs italic subtle">
                    Cap participant en aquest estat.
                  </li>
                ) : (
                  sectionRows.map((row) => (
                    <AttendanceRow
                      key={row.participant.id}
                      row={row}
                      teamName={teamNameOf.get(row.participant.id)}
                      selected={selected.has(row.participant.id)}
                      selectable={editable}
                      editable={editable}
                      onToggleSelect={() => toggleSelected(row.participant.id)}
                      onOpenDetail={() =>
                        setDetailParticipantId(row.participant.id)
                      }
                    />
                  ))
                )}
              </AttendanceSection>
            );
          })}
        </div>
      )}

      <AttendanceBulkBar
        selectedCount={selected.size}
        onApply={applyStatusToSelection}
        onClear={() => setSelected(new Set())}
      />

      {detailRow && editable ? (
        <AttendanceDetailDialog
          row={detailRow}
          teamName={teamNameOf.get(detailRow.participant.id)}
          onClose={() => setDetailParticipantId(null)}
          onSave={(patch) => applyDetailOverride(detailRow.participant.id, patch)}
        />
      ) : null}
    </div>
  );
}

/**
 * Capçalera amb resum, cerca i accions globals.
 * Aïllat com a sub-component per mantenir AttendanceTab llegible.
 */
function Header({
  editable,
  dirtyCount,
  saving,
  search,
  onSearchChange,
  onSave,
  onResetAll,
  totalCounts,
}: {
  editable: boolean;
  dirtyCount: number;
  saving: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  onSave: () => void;
  onResetAll: () => void;
  totalCounts: Record<AttendanceStatus, number>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm muted">
          Tothom comença com a <strong>Present</strong>. Selecciona els
          participants que vulguis i aplica una acció massiva des de la barra
          inferior. Per ajustar bonus o penalització d'algú concret, obre
          "Detalls".
        </p>
        {editable ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onResetAll}>
              Marca tothom present
            </Button>
            <Button onClick={onSave} disabled={dirtyCount === 0 || saving}>
              {saving
                ? "Desant…"
                : dirtyCount > 0
                ? `Desa ${dirtyCount} canvi${dirtyCount === 1 ? "" : "s"}`
                : "Res per desar"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cerca per nom…"
          className="max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.map((s) => (
            <Badge key={s} tone={STATUS_TONES[s]}>
              {attendanceLabels[s]}:{" "}
              <strong className="ml-1">{totalCounts[s]}</strong>
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function computeEligibleParticipants(
  participants: Participant[],
  attendance: AttendanceRecord[]
): Participant[] {
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
}

function buildInitialRows(
  eligible: Participant[],
  attendance: AttendanceRecord[]
): Row[] {
  const byParticipant = new Map(
    attendance.map((a) => [a.participantId, a] as const)
  );
  return eligible.map((p) => {
    const existing = byParticipant.get(p.id);
    const status = existing?.status ?? "present";
    const d = defaultsFor(status);
    return {
      participant: p,
      status,
      bonusPoints: existing?.bonusPoints ?? d.bonusPoints,
      penaltyPoints: existing?.penaltyPoints ?? d.penaltyPoints,
      comment: existing?.comment ?? "",
      dirty: false,
    };
  });
}

function countByStatus(rows: Row[]): Record<AttendanceStatus, number> {
  const counts: Record<AttendanceStatus, number> = {
    present: 0,
    late: 0,
    absent_notified: 0,
    absent_unnotified: 0,
  };
  for (const r of rows) counts[r.status] += 1;
  return counts;
}
