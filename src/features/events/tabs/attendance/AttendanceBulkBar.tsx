import { Button } from "@/ui/forms";
import type { AttendanceStatus } from "@/domain/types";
import { attendanceLabels } from "@/domain/attendanceDefaults";
import { STATUS_ORDER } from "./types";

interface Props {
  selectedCount: number;
  onApply: (status: AttendanceStatus) => void;
  onClear: () => void;
}

/**
 * Barra fixa que apareix al peu quan hi ha selecció activa.
 *
 * Disseny pensat per a mòbil: sempre visible (sticky bottom), botons grans,
 * tap targets amplis. La idea és que l'admin pugui "tocar 30 participants"
 * i amb un sol click "Marca'ls com a Tard".
 *
 * Retornem `null` si no hi ha selecció per evitar ocupar espai inútilment.
 */
export function AttendanceBulkBar({ selectedCount, onApply, onClear }: Props) {
  if (selectedCount === 0) return null;

  return (
    <div
      role="region"
      aria-label="Accions massives"
      className="sticky bottom-2 z-10 mx-auto w-full"
    >
      <div className="card card-pad flex flex-wrap items-center gap-2 border-brand-200 bg-brand-50/95 shadow-lg backdrop-blur dark:border-brand-500/30 dark:bg-brand-500/10">
        <div className="flex items-center gap-2 text-sm font-medium text-brand-800 dark:text-brand-200">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-600 px-2 text-xs font-semibold text-white dark:bg-brand-500">
            {selectedCount}
          </span>
          seleccionats
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {STATUS_ORDER.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={s === "present" ? "primary" : "secondary"}
              onClick={() => onApply(s)}
            >
              {attendanceLabels[s]}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={onClear}>
            Cancel·la
          </Button>
        </div>
      </div>
    </div>
  );
}
