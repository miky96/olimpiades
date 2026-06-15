import { useEffect, useState } from "react";
import { Badge, Button, Field, Input, Select } from "@/ui/forms";
import type { AttendanceStatus } from "@/domain/types";
import {
  attendanceLabels,
  defaultsFor,
} from "@/domain/attendanceDefaults";
import type { AttendanceRow } from "./types";
import { STATUS_ORDER, STATUS_TONES } from "./types";

interface Props {
  row: AttendanceRow;
  teamName?: string;
  onClose: () => void;
  onSave: (patch: {
    status: AttendanceStatus;
    bonusPoints: number;
    penaltyPoints: number;
    comment: string;
  }) => void;
}

/**
 * Modal lleuger per editar overrides d'un sol participant.
 *
 * Decisió pragmàtica (vs. usar `DialogProvider`): el provider central només
 * exposa `alert/confirm/prompt`. Aquest formulari té camps múltiples i lògica
 * pròpia (canvi d'estat → reset de defaults, botó "torna als valors per
 * defecte"), així que mantenim un modal local amb les mateixes convencions
 * visuals (overlay, capa, max-width).
 */
export function AttendanceDetailDialog({
  row,
  teamName,
  onClose,
  onSave,
}: Props) {
  const [status, setStatus] = useState<AttendanceStatus>(row.status);
  const [bonus, setBonus] = useState<number>(row.bonusPoints);
  const [penalty, setPenalty] = useState<number>(row.penaltyPoints);
  const [comment, setComment] = useState<string>(row.comment);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  function handleStatusChange(next: AttendanceStatus) {
    const d = defaultsFor(next);
    setStatus(next);
    setBonus(d.bonusPoints);
    setPenalty(d.penaltyPoints);
  }

  function handleResetDefaults() {
    const d = defaultsFor(status);
    setBonus(d.bonusPoints);
    setPenalty(d.penaltyPoints);
    setComment("");
  }

  function handleSubmit() {
    onSave({
      status,
      bonusPoints: Number.isFinite(bonus) ? bonus : 0,
      penaltyPoints: Number.isFinite(penalty) ? penalty : 0,
      comment: comment.trim(),
    });
  }

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm dark:bg-slate-950/60"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl outline-none dark:border-slate-800/80 dark:bg-slate-900 sm:p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {row.participant.name}
            </h2>
            <p className="mt-0.5 text-xs subtle">{teamName ?? "Sense equip"}</p>
          </div>
          <Badge tone={STATUS_TONES[status]}>{attendanceLabels[status]}</Badge>
        </div>

        <div className="mt-4 space-y-3">
          <Field label="Estat">
            <Select
              value={status}
              onChange={(e) =>
                handleStatusChange(e.target.value as AttendanceStatus)
              }
              className="h-10"
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {attendanceLabels[s]}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Bonus">
              <Input
                type="number"
                step={1}
                value={bonus}
                onChange={(e) => setBonus(Number(e.target.value))}
              />
            </Field>
            <Field label="Penalització">
              <Input
                type="number"
                step={1}
                value={penalty}
                onChange={(e) => setPenalty(Number(e.target.value))}
              />
            </Field>
          </div>

          <Field label="Comentari">
            <Input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Motiu / nota"
            />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={handleResetDefaults}>
            Torna als valors per defecte
          </Button>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel·la
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit}>
            Aplica
          </Button>
        </div>
      </div>
    </div>
  );
}
