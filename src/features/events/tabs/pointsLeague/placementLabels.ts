/** Ordinal català abreujat: 1r, 2n, 3r, 4t, 5è, ... */
export function ordinalCa(n: number): string {
  if (n === 1) return "1r";
  if (n === 2) return "2n";
  if (n === 3) return "3r";
  if (n === 4) return "4t";
  return `${n}è`;
}

/**
 * Resum compacte del recompte de posicions, p. ex. "2×1r · 1×3r".
 * Només inclou les posicions amb almenys una aparició.
 */
export function formatPlacementSummary(placements: number[] | undefined): string {
  if (!placements) return "—";
  const parts = placements
    .map((count, idx) => (count > 0 ? `${count}×${ordinalCa(idx + 1)}` : null))
    .filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(" · ") : "—";
}
