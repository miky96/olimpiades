import { useState } from "react";
import { Input } from "@/ui/forms";
import { pointsRoundsRepo } from "@/data";
import type { PointsRound, Team } from "@/domain/types";
import { computePointsLeagueStandings } from "@/domain/competition/pointsLeague";

interface Props {
  seasonId: string;
  eventId: string;
  teams: Team[];
  rounds: PointsRound[];
  editable: boolean;
  onChanged: () => Promise<void> | void;
}

/**
 * Graella editable de puntuacions: files = participants, columnes = rondes.
 *
 * Cada cel·la és un input numèric optimista (debounced via `onBlur`): així
 * l'admin pot anar editant sense que cada tecla provoqui un write a
 * Firestore. La columna "Total" es calcula al vol.
 *
 * Empats al rànquing es resolen alfabèticament pel nom del participant
 * (ja gestionat per `computePointsLeagueStandings`).
 */
export function PointsLeagueScoresGrid({
  seasonId,
  eventId,
  teams,
  rounds,
  editable,
  onChanged,
}: Props) {
  const sortedRounds = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
  const standings = computePointsLeagueStandings(teams, rounds);
  // Ordenem files per posició a la lligueta (millor a dalt) per fer la
  // graella més útil mentre s'edita.
  const orderedTeams = standings
    .map((s) => teams.find((t) => t.id === s.teamId))
    .filter((t): t is Team => Boolean(t));
  const totalsByTeam = new Map(standings.map((s) => [s.teamId, s.total]));

  if (sortedRounds.length === 0) {
    return (
      <p className="px-4 py-6 text-sm muted sm:px-6">
        Encara no hi ha cap ronda. Afegeix-ne una per començar a puntuar.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50/80 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2">Participant</th>
            {sortedRounds.map((r) => (
              <th key={r.id} className="px-3 py-2 text-center">
                R{r.roundNumber}
              </th>
            ))}
            <th className="px-3 py-2 text-center">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
          {orderedTeams.map((team) => (
            <tr key={team.id} className="text-slate-700 dark:text-slate-300">
              <td className="px-3 py-1.5 font-medium text-slate-900 dark:text-white">
                {team.name}
              </td>
              {sortedRounds.map((r) => (
                <ScoreCell
                  key={`${r.id}-${team.id}`}
                  seasonId={seasonId}
                  eventId={eventId}
                  round={r}
                  teamId={team.id}
                  editable={editable}
                  onChanged={onChanged}
                />
              ))}
              <td className="px-3 py-1.5 text-center font-bold text-brand-700 dark:text-brand-300">
                {totalsByTeam.get(team.id) ?? 0}
              </td>
            </tr>
          ))}
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
  editable,
  onChanged,
}: {
  seasonId: string;
  eventId: string;
  round: PointsRound;
  teamId: string;
  editable: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const stored = round.scores[teamId];
  const [text, setText] = useState<string>(
    stored != null ? String(stored) : ""
  );
  const [busy, setBusy] = useState(false);

  async function commit() {
    if (!editable) return;
    const trimmed = text.trim();
    const next = trimmed === "" ? 0 : Number(trimmed);
    if (!Number.isFinite(next)) {
      // Valor invàlid → revertim al guardat. No fem write.
      setText(stored != null ? String(stored) : "");
      return;
    }
    if (next === (stored ?? 0)) return; // no canvi → sense write
    setBusy(true);
    try {
      await pointsRoundsRepo.setScore(seasonId, eventId, round.id, teamId, next);
      await onChanged();
    } catch (err) {
      console.error(err);
      // Si falla, revertim al guardat per coherència visual.
      setText(stored != null ? String(stored) : "");
    } finally {
      setBusy(false);
    }
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
        inputMode="decimal"
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
        aria-label={`Puntuació ronda ${round.roundNumber}`}
      />
    </td>
  );
}
