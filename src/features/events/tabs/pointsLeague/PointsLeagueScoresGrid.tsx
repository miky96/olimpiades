import { useState } from "react";
import { Input } from "@/ui/forms";
import { pointsRoundsRepo } from "@/data";
import type { PointsRound, Team } from "@/domain/types";
import {
  computePointsLeagueStandings,
  isValidPlacement,
  type PointsLeagueMode,
} from "@/domain/competition/pointsLeague";
import { formatPlacementSummary } from "./placementLabels";

interface Props {
  seasonId: string;
  eventId: string;
  teams: Team[];
  rounds: PointsRound[];
  mode: PointsLeagueMode;
  editable: boolean;
  onChanged: () => Promise<void> | void;
}

/**
 * Graella editable: files = participants, columnes = rondes.
 *
 * Mode "points": cada cel·la són els punts de la ronda; la columna final és
 * el total. Mode "placement": cada cel·la és la posició (1 = primer); la
 * columna final és el recompte de posicions (p. ex. "2×1r · 1×2n").
 *
 * Cada cel·la és un input optimista que desa a `onBlur`, així no hi ha un
 * write a Firestore per cada tecla.
 */
export function PointsLeagueScoresGrid({
  seasonId,
  eventId,
  teams,
  rounds,
  mode,
  editable,
  onChanged,
}: Props) {
  const sortedRounds = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
  const standings = computePointsLeagueStandings(teams, rounds, mode);
  // Ordenem files per posició a la lligueta (millor a dalt).
  const orderedTeams = standings
    .map((s) => teams.find((t) => t.id === s.teamId))
    .filter((t): t is Team => Boolean(t));
  const standingByTeam = new Map(standings.map((s) => [s.teamId, s]));
  const placementMode = mode === "placement";

  if (sortedRounds.length === 0) {
    return (
      <p className="px-4 py-6 text-sm muted sm:px-6">
        Encara no hi ha cap ronda. Afegeix-ne una per començar a{" "}
        {placementMode ? "posar posicions" : "puntuar"}.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      {placementMode && editable ? (
        <p className="px-4 pt-3 text-xs subtle sm:px-6">
          Escriu la posició de cada participant a la ronda (1 = primer). Si dos
          empaten, posa'ls la mateixa posició. Deixa-la buida si no ha jugat.
        </p>
      ) : null}
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50/80 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2">Participant</th>
            {sortedRounds.map((r) => (
              <th key={r.id} className="px-3 py-2 text-center">
                R{r.roundNumber}
              </th>
            ))}
            <th className="px-3 py-2 text-center">
              {placementMode ? "Posicions" : "Total"}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
          {orderedTeams.map((team) => {
            const s = standingByTeam.get(team.id);
            return (
              <tr key={team.id} className="text-slate-700 dark:text-slate-300">
                <td className="px-3 py-1.5 font-medium text-slate-900 dark:text-white">
                  {team.name}
                </td>
                {sortedRounds.map((r) => (
                  <ScoreCell
                    key={`${r.id}-${team.id}-${r.scores[team.id] ?? ""}`}
                    seasonId={seasonId}
                    eventId={eventId}
                    round={r}
                    teamId={team.id}
                    mode={mode}
                    editable={editable}
                    onChanged={onChanged}
                  />
                ))}
                <td className="whitespace-nowrap px-3 py-1.5 text-center font-bold text-brand-700 dark:text-brand-300">
                  {placementMode
                    ? formatPlacementSummary(s?.placements)
                    : s?.total ?? 0}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ScoreCell({
  seasonId,
  eventId,
  round,
  teamId,
  mode,
  editable,
  onChanged,
}: {
  seasonId: string;
  eventId: string;
  round: PointsRound;
  teamId: string;
  mode: PointsLeagueMode;
  editable: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const stored = round.scores[teamId];
  const [text, setText] = useState<string>(
    stored != null ? String(stored) : ""
  );
  const [busy, setBusy] = useState(false);
  const placementMode = mode === "placement";

  function revert() {
    setText(stored != null ? String(stored) : "");
  }

  async function write(op: () => Promise<void>) {
    setBusy(true);
    try {
      await op();
      await onChanged();
    } catch (err) {
      console.error(err);
      revert();
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!editable) return;
    const trimmed = text.trim();

    // Mode posicions: buit = no ha jugat (s'esborra el valor).
    if (placementMode && trimmed === "") {
      if (stored == null) return;
      await write(() =>
        pointsRoundsRepo.clearScore(seasonId, eventId, round.id, teamId)
      );
      return;
    }

    const next = trimmed === "" ? 0 : Number(trimmed);
    const valid = placementMode ? isValidPlacement(next) : Number.isFinite(next);
    if (!valid) {
      revert();
      return;
    }
    if (placementMode ? next === stored : next === (stored ?? 0)) return;
    await write(() =>
      pointsRoundsRepo.setScore(seasonId, eventId, round.id, teamId, next)
    );
  }

  if (!editable) {
    return (
      <td className="px-3 py-1.5 text-center tabular-nums">
        {stored ?? "—"}
      </td>
    );
  }

  return (
    <td className="px-2 py-1 text-center">
      <Input
        type="number"
        inputMode={placementMode ? "numeric" : "decimal"}
        min={placementMode ? 1 : undefined}
        step={placementMode ? 1 : undefined}
        className="h-8 w-16 px-2 py-0 text-center text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        disabled={busy}
        aria-label={`${placementMode ? "Posició" : "Puntuació"} ronda ${round.roundNumber}`}
      />
    </td>
  );
}
