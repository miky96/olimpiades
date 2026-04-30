import type { ReactNode } from "react";
import { Badge } from "@/ui/forms";
import type { AttendanceStatus } from "@/domain/types";
import { attendanceLabels } from "@/domain/attendanceDefaults";
import { STATUS_TONES } from "./types";

interface Props {
  status: AttendanceStatus;
  count: number;
  collapsed: boolean;
  selectedCount: number;
  totalSelectable: number;
  onToggleCollapsed: () => void;
  onToggleSelectAll: () => void;
  selectable: boolean;
  children: ReactNode;
}

/**
 * Capçalera plegable d'una secció d'estat d'assistència.
 * Inclou:
 *  - Indicador de si hi ha estat tot/parcialment/res seleccionat dins.
 *  - Acció ràpida "Selecciona tots els d'aquesta secció".
 *  - Toggle per col·lapsar/expandir el contingut.
 *
 * És un component "tonto": no coneix les files, només estats agregats.
 */
export function AttendanceSection({
  status,
  count,
  collapsed,
  selectedCount,
  totalSelectable,
  onToggleCollapsed,
  onToggleSelectAll,
  selectable,
  children,
}: Props) {
  const allSelected = totalSelectable > 0 && selectedCount === totalSelectable;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-slate-200/70 bg-slate-50/60 px-3 py-2 dark:border-slate-800/70 dark:bg-slate-800/30">
        {selectable ? (
          <button
            type="button"
            onClick={onToggleSelectAll}
            disabled={totalSelectable === 0}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              allSelected
                ? "border-brand-600 bg-brand-600 text-white dark:border-brand-400 dark:bg-brand-500"
                : someSelected
                ? "border-brand-600 bg-brand-100 text-brand-700 dark:border-brand-400 dark:bg-brand-500/20 dark:text-brand-200"
                : "border-slate-300 dark:border-slate-600"
            }`}
            aria-label={
              allSelected
                ? "Desselecciona tots d'aquesta secció"
                : "Selecciona tots d'aquesta secció"
            }
            title={
              allSelected
                ? "Desselecciona tots d'aquesta secció"
                : "Selecciona tots d'aquesta secció"
            }
          >
            {allSelected ? (
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
                <path d="M6.293 11.707l-3-3 1.414-1.414L6.293 8.879l4.293-4.293 1.414 1.414z" />
              </svg>
            ) : someSelected ? (
              <span className="block h-0.5 w-2.5 bg-current" />
            ) : null}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex flex-1 items-center gap-2 text-left"
          aria-expanded={!collapsed}
        >
          <span
            className={`text-slate-500 transition-transform dark:text-slate-400 ${
              collapsed ? "" : "rotate-90"
            }`}
            aria-hidden="true"
          >
            ▶
          </span>
          <Badge tone={STATUS_TONES[status]}>{attendanceLabels[status]}</Badge>
          <span className="text-xs subtle">
            {count} {count === 1 ? "participant" : "participants"}
            {selectedCount > 0 ? ` · ${selectedCount} sel.` : ""}
          </span>
        </button>
      </header>
      {!collapsed ? (
        <ul className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
          {children}
        </ul>
      ) : null}
    </section>
  );
}
