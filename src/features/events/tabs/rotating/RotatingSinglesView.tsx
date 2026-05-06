import { useMemo, useState } from "react";
import { Badge, Button, ErrorMessage } from "@/ui/forms";
import { useDialog } from "@/ui/dialog/useDialog";
import { attendanceRepo, eventsRepo, matchesRepo } from "@/data";
import type { Match } from "@/domain/types";
import {
  areAllRotatingMatchesDecided,
  calculateRotatingEventPoints,
  computeRotatingIndividualStandings,
  lastRotatingRound,
} from "@/domain";
import { useSeasons } from "@/features/seasons/useSeasons";
import type { EventData } from "../../EventDetailPage";
import { RotatingRoundsList } from "./RotatingRoundsList";
import { RotatingStandingsTable } from "./RotatingStandingsTable";
import { addNextRotatingRound } from "./rotatingActions";

interface Props {
  data: EventData;
  readOnly: boolean;
  onChanged: () => Promise<void> | void;
}

export function RotatingSinglesView({ data, readOnly, onChanged }: Props) {
  const dialog = useDialog();
  const { currentSeason } = useSeasons();
  const { event, matches, teams, attendance, participants } = data;
  const seasonId = currentSeason?.id ?? "";
  const editable = !readOnly && event.status === "in_progress";

  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );

  const round = lastRotatingRound(matches);
  const allDecided = areAllRotatingMatchesDecided(matches);
  const canFinalize = editable && round >= 1 && allDecided;
  const canAddNext = editable && round >= 1 && allDecided;

  async function handleSetWinner(m: Match, winnerTeamId: string | null) {
    if (!editable) return;
    setBusyMatchId(m.id);
    setError(null);
    try {
      await matchesRepo.setResult(seasonId, event.id, m.id, { winnerTeamId });
      await onChanged();
    } catch (err) {
      console.error(err);
      setError("No s'ha pogut desar el resultat.");
    } finally {
      setBusyMatchId(null);
    }
  }

  async function handleAddNext() {
    if (!canAddNext) return;
    setError(null);
    const continueIt = await dialog.confirm({
      title: "Nou partit?",
      message:
        "Vols afegir un altre partit a la sèrie? Si no, podràs finalitzar la competició.",
      confirmLabel: "Sí, nou partit",
    });
    if (!continueIt) return;
    const regenerate = await dialog.confirm({
      title: "Regenerar equips?",
      message:
        "Vols barrejar els participants i crear 2 equips nous? Si dius que no, es manté la mateixa composició.",
      confirmLabel: "Sí, regenerar",
    });
    setBusy(true);
    try {
      await addNextRotatingRound({
        seasonId,
        eventId: event.id,
        matches,
        teams,
        participants,
        attendance,
        regenerate,
      });
      await onChanged();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "No s'ha pogut crear el partit."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleFinalize() {
    if (!canFinalize) return;
    const ok = await dialog.confirm({
      title: "Finalitzar esdeveniment",
      message:
        "Es calcularà la classificació individual i es desaran els punts. Podràs reobrir-lo si cal.",
      confirmLabel: "Finalitzar",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const fullAttendance = await attendanceRepo.ensureDefaults(
        seasonId,
        event.id,
        { participants, existing: attendance }
      );
      const attendanceByParticipant = Object.fromEntries(
        fullAttendance.map((a) => [a.participantId, a])
      );
      const individualStandings = computeRotatingIndividualStandings(
        matches,
        teams
      );
      const breakdown = calculateRotatingEventPoints({
        matches,
        teams,
        individualStandings,
        attendance: attendanceByParticipant,
      });
      await eventsRepo.update(seasonId, event.id, {
        status: "finished",
        finalStandings: [],
        individualFinalStandings: individualStandings,
        pointsBreakdown: breakdown,
      });
      await onChanged();
    } catch (err) {
      console.error(err);
      setError("No s'ha pogut finalitzar l'esdeveniment.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReopen() {
    if (readOnly) return;
    const ok = await dialog.confirm({
      title: "Reobrir esdeveniment",
      message:
        "Es recalcularan els punts quan el tornis a finalitzar. Vols continuar?",
      confirmLabel: "Reobrir",
    });
    if (!ok) return;
    try {
      await eventsRepo.update(seasonId, event.id, {
        status: "in_progress",
        finalStandings: [],
        individualFinalStandings: [],
        pointsBreakdown: [],
      });
      await onChanged();
    } catch (err) {
      console.error(err);
      setError("No s'ha pogut reobrir l'esdeveniment.");
    }
  }

  if (matches.length === 0) {
    return (
      <div className="card card-pad text-sm muted">
        Encara no s'ha iniciat la competició. Ves a la pestanya{" "}
        <em>Equips</em> per crear 2 equips i començar.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}

      <section className="card">
        <div className="card-header">
          <span>
            Partits jugats <Badge tone="slate">{round}</Badge>
          </span>
        </div>
        <RotatingRoundsList
          matches={matches}
          teamById={teamById}
          editable={editable}
          busyMatchId={busyMatchId}
          onSetWinner={handleSetWinner}
        />
      </section>

      <section className="card card-pad space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest muted">
          Classificació individual
        </h2>
        <RotatingStandingsTable
          matches={matches}
          teams={teams}
          participants={participants}
        />
      </section>

      {editable ? (
        <section className="card flex flex-wrap items-center gap-3 card-pad">
          <Button onClick={handleAddNext} disabled={busy || !canAddNext}>
            {busy ? "Treballant…" : "Nou partit / regenerar equips"}
          </Button>
          <Button
            variant="primary"
            onClick={handleFinalize}
            disabled={busy || !canFinalize}
            size="lg"
          >
            🏆 Finalitzar i calcular punts
          </Button>
          {!allDecided ? (
            <p className="text-sm muted">
              Marca el guanyador del partit actual per poder continuar.
            </p>
          ) : null}
        </section>
      ) : null}

      {event.status === "finished" ? (
        <RotatingFinalSummary data={data} onReopen={readOnly ? undefined : handleReopen} />
      ) : null}
    </div>
  );
}

function RotatingFinalSummary({
  data,
  onReopen,
}: {
  data: EventData;
  onReopen?: () => void;
}) {
  const { event, participants } = data;
  const participantById = new Map(participants.map((p) => [p.id, p]));

  return (
    <section className="card relative overflow-hidden border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/5">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-300 to-emerald-600"
      />
      <div className="p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-200">
              Esdeveniment finalitzat
            </h2>
          </div>
          {onReopen ? (
            <Button variant="secondary" size="sm" onClick={onReopen}>
              Reobrir
            </Button>
          ) : null}
        </div>

        {event.individualFinalStandings &&
        event.individualFinalStandings.length > 0 ? (
          <div className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-800 dark:text-emerald-300">
              Classificació individual
            </h3>
            <ol className="space-y-1.5 text-sm">
              {event.individualFinalStandings.map((s, idx) => (
                <li key={s.position} className="flex items-center gap-2">
                  <Badge
                    tone={
                      idx === 0
                        ? "amber"
                        : idx === 1
                        ? "slate"
                        : idx === 2
                        ? "rose"
                        : "slate"
                    }
                  >
                    {s.position}
                  </Badge>
                  <span className="text-slate-800 dark:text-slate-200">
                    {s.participantIds
                      .map((pid) => participantById.get(pid)?.name ?? pid)
                      .join(", ")}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {event.pointsBreakdown && event.pointsBreakdown.length > 0 ? (
          <div className="overflow-x-auto">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-800 dark:text-emerald-300">
              Punts per participant
            </h3>
            <table className="min-w-full text-xs">
              <thead className="text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2">Participant</th>
                  <th className="py-2 text-center">PJ</th>
                  <th className="py-2 text-center">G</th>
                  <th className="py-2 text-center">Pts partit</th>
                  <th className="py-2 text-center">Punts pos.</th>
                  <th className="py-2 text-center">Bonus</th>
                  <th className="py-2 text-center">Pen.</th>
                  <th className="py-2 text-center">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-200/50 dark:divide-emerald-500/20">
                {event.pointsBreakdown
                  .slice()
                  .sort((a, b) => b.total - a.total)
                  .map((b) => (
                    <tr
                      key={b.participantId}
                      className="text-slate-700 dark:text-slate-300"
                    >
                      <td className="py-1.5 font-medium">
                        {participantById.get(b.participantId)?.name ??
                          b.participantId}
                      </td>
                      <td className="py-1.5 text-center">
                        {b.matchesPlayed ?? 0}
                      </td>
                      <td className="py-1.5 text-center">
                        {b.matchesWon ?? 0}
                      </td>
                      <td className="py-1.5 text-center">
                        {b.matchPoints ?? 0}
                      </td>
                      <td className="py-1.5 text-center">{b.positionPoints}</td>
                      <td className="py-1.5 text-center">{b.bonusPoints}</td>
                      <td className="py-1.5 text-center">{b.penaltyPoints}</td>
                      <td className="py-1.5 text-center font-bold text-emerald-700 dark:text-emerald-300">
                        {b.total}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

