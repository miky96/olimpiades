import { useState } from "react";
import { Input } from "@/ui/forms";

/**
 * Input numèric que desa en perdre el focus (o amb Enter). Buit = sense
 * puntuació. Admet decimals (p. ex. temps en minuts).
 */
export function ScoreInput({
  stored,
  editable,
  label,
  onCommit,
}: {
  stored: number | null;
  editable: boolean;
  label: string;
  onCommit: (value: number | null) => Promise<void>;
}) {
  const [text, setText] = useState(stored != null ? String(stored) : "");
  const [busy, setBusy] = useState(false);

  if (!editable) {
    return <span className="tabular-nums">{stored ?? "—"}</span>;
  }

  async function commit() {
    const trimmed = text.trim().replace(",", ".");
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && !Number.isFinite(next)) {
      setText(stored != null ? String(stored) : "");
      return;
    }
    if (next === stored) return;
    setBusy(true);
    try {
      await onCommit(next);
    } catch {
      setText(stored != null ? String(stored) : "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      className="h-8 w-24 px-2 py-0 text-center text-sm"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      disabled={busy}
      aria-label={label}
      placeholder="—"
    />
  );
}
