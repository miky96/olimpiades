import { Badge, Button } from "@/ui/forms";
import { attendanceLabels, defaultsFor } from "@/domain/attendanceDefaults";
import type { AttendanceRow as Row } from "./types";
import { STATUS_TONES } from "./types";

interface Props {
  row: Row;
  teamName?: string;
  selected: boolean;
  selectable: boolean;
  editable: boolean;
  onToggleSelect: () => void;
  onOpenDetail: () => void;
}

/**
 * Fila compacta d'un participant. Pensada per a llistes molt llargues
 * (desenes/centenars de files): mínima alçada, tap target gran a tot
 * el cos per seleccionar, i un botó dedicat "Detalls" per editar overrides.
 */
export function AttendanceRow({
  row,
  teamName,
  selected,
  selectable,
  editable,
  onToggleSelect,
  onOpenDetail,
}: Props) {
  const overrides = hasOverrides(row);
  return (
    <li
      className={`flex items-center gap-3 px-3 py-2 transition-colors ${
        selected
          ? "bg-brand-50 dark:bg-brand-500/10"
          : row.dirty
          ? "bg-amber-50/70 dark:bg-amber-500/5"
          : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
      }`}
    >
      <button
        type="button"
        onClick={onToggleSelect}
        disabled={!selectable}
        className="flex flex-1 items-center gap-3 text-left disabled:cursor-not-allowed"
        aria-pressed={selected}
        aria-label={selected ? "Desselecciona" : "Selecciona"}
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
            selected
              ? "border-brand-600 bg-brand-600 text-white dark:border-brand-400 dark:bg-brand-500"
              : "border-slate-300 dark:border-slate-600"
          }`}
          aria-hidden="true"
        >
          {selected ? (
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
              <path d="M6.293 11.707l-3-3 1.414-1.414L6.293 8.879l4.293-4.293 1.414 1.414z" />
            </svg>
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-slate-900 dark:text-slate-100">
            {row.participant.name}
          </span>
          <span className="block truncate text-xs subtle">
            {teamName ?? "Sense equip"}
            {overrides ? (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                · personalitzat
              </span>
            ) : null}
          </span>
        </span>
        <Badge tone={STATUS_TONES[row.status]} className="shrink-0">
          {attendanceLabels[row.status]}
        </Badge>
      </button>
      {editable ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenDetail}
          aria-label="Editar detalls"
          title="Editar detalls (bonus, penalització, comentari)"
        >
          Detalls
        </Button>
      ) : null}
    </li>
  );
}

/**
 * Detecta si la fila té valors fora del default per al seu estat.
 * Útil per indicar-ho visualment ("personalitzat") i evitar sorpreses.
 */
function hasOverrides(row: Row): boolean {
  const d = defaultsFor(row.status);
  return (
    row.bonusPoints !== d.bonusPoints ||
    row.penaltyPoints !== d.penaltyPoints ||
    (row.comment ?? "").trim().length > 0
  );
}
