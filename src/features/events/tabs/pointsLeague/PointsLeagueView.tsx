import { useMemo, useState } from "react";
import { Badge, Button, ErrorMessage, Field, Input } from "@/ui/forms";
import { useDialog } from "@/ui/dialog/useDialog";
import {
  attendanceRepo,
  eventsRepo,
  matchesRepo,
  pointsRoundsRepo,
} from "@/data";
import type { Match, MatchPhase, Team } from "@/domain/types";
import {
  advanceBracket,
  areAllMatchesDecided,
  calculateEventPoints,
  computePointsLeagueFinalStandings,
  computePointsLeagueStandings,
  nextPowerOfTwo,
  phaseForRoundsToFinal,
} from "@/domain";
import { useSeasons } from "@/features/seasons/useSeasons";
import type { EventData } from "../../EventDetailPage";
import { PointsLeagueScoresGrid } from "./PointsLeagueScoresGrid";
import {
  addEmptyRound,
  generatePointsLeagueBracket,
  resetBracketOnly,
} from "./pointsLeagueActions";

interface Props {
  data: EventData;
  readOnly: boolean;
  onChanged: () => Promise<void> | void;
}

const PHASE_LABELS: Record<MatchPhase, string> = {
  group: "Fase de grups",
  round_of_16: "Vuitens",
  quarter: "Quarts",
  semi: "Semifinals",
  final: "Final",
  third_place: "Tercer i quart",
  single: "Partit únic",
  rotating: "Partit rotatiu",
};

const PHASE_ORDER: MatchPhase[] = [
  "round_of_16",
  "quarter",
  "semi",
  "final",
  "third_place",
  "single",
];

const QUALIFIER_PRESETS = [4, 8, 16];

export function PointsLeagueView({ data, readOnly, onChanged }: Props) {
  const dialog = useDialog();
  const { currentSeason } = useSeasons();
  const { event, teams, matches, attendance, participants, pointsRounds } =
    data;
  const seasonId = currentSeason?.id ?? "";
  const editable = !readOnly && event.status === "in_progress";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qualifierText, setQualifierText] = useState<string>(
    String(event.config.bracketQualifiers ?? 4)
  );

  const bracketStarted = matches.length > 0;
  const standings = useMemo(
    () => computePointsLeagueStandings(teams, pointsRounds),
    [teams, pointsRounds]
  );
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  async function handleAddRound() {
    if (!editable || bracketStarted) return;
    setError(null);
    setBusy(true);
    try {
      await addEmptyRound({
        seasonId,
        eventId: event.id,
        existingRounds: pointsRounds,
      });
      await onChanged();
    } catch (err) {
      console.error(err);
      setError("No s'ha pogut afegir la ronda.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveLastRound() {
    if (!editable || bracketStarted) return;
    if (pointsRounds.length === 0) return;
    const last = [...pointsRounds].sort(
      (a, b) => b.roundNumber - a.roundNumber
    )[0];
    const ok = await dialog.confirm({
      title: `Eliminar ronda ${last.roundNumber}?`,
      message: "Es perdran totes les puntuacions d'aquesta ronda.",
      confirmLabel: "Eliminar",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await pointsRoundsRepo.remove(seasonId, event.id, last.id);
      await onChanged();
    } catch (err) {
      console.error(err);
      setError("No s'ha pogut eliminar la ronda.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateBracket() {
    if (!editable || bracketStarted) return;
    setError(null);
    const x = Number(qualifierText);
    if (!Number.isInteger(x) || x < 2) {
      setError("El nombre de classificats ha de ser un enter ≥ 2.");
      return;
    }
    if (x > teams.length) {
      setError(
        `Has demanat ${x} classificats però només hi ha ${teams.length} participants.`
      );
      return;
    }
    const ok = await dialog.confirm({
      title: "Generar eliminatòria",
      message: `Es passarà a la fase d'eliminatòria amb els ${x} primers classificats. La lligueta es bloquejarà.`,
      confirmLabel: "Generar",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await generatePointsLeagueBracket({
        seasonId,
        eventId: event.id,
        config: event.config,
        teams,
        rounds: pointsRounds,
        qualifierCount: x,
      });
      await onChanged();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "No s'ha pogut generar el bracket."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleResetBracket() {
    if (!editable || !bracketStarted) return;
    const ok = await dialog.confirm({
      title: "Refer l'eliminatòria",
      message:
        "S'esborraran els partits del bracket però es conservaran les rondes de puntuació. Podràs tornar a triar els classificats. Vols continuar?",
      confirmLabel: "Refer",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await resetBracketOnly({
        seasonId,
        eventId: event.id,
        config: event.config,
      });
      await onChanged();
    } catch (err) {
      console.error(err);
      setError("No s'ha pogut esborrar el bracket.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSetWinner(m: Match, winnerTeamId: string | null) {
    if (!editable) return;
    setBusy(true);
    setError(null);
    try {
      await matchesRepo.setResult(seasonId, event.id, m.id, { winnerTeamId });
      await onChanged();
    } catch (err) {
      console.error(err);
      setError("No s'ha pogut desar el resultat.");
    } finally {
      setBusy(false);
    }
  }

  const currentBracketRound = useMemo(() => {
    let max = 0;
    for (const m of matches) {
      if ((m.round ?? 0) > max) max = m.round ?? 0;
    }
    return max;
  }, [matches]);

  const currentRoundMatches = useMemo(
    () => matches.filter((m) => (m.round ?? 0) === currentBracketRound),
    [matches, currentBracketRound]
  );
  const currentRoundComplete =
    currentRoundMatches.length > 0 && areAllMatchesDecided(currentRoundMatches);
  const hasFinalMatch = currentRoundMatches.some(
    (m) => m.phase === "final" || m.phase === "single"
  );
  const canAdvanceBracket =
    editable && currentRoundMatches.length > 1 && currentRoundComplete && !hasFinalMatch;

  async function handleAdvanceBracket() {
    if (!canAdvanceBracket) return;
    setBusy(true);
    setError(null);
    try {
      const next = advanceBracket(currentRoundMatches, { eventId: event.id });
      if (next.length === 0) {
        setError("Encara no es pot avançar (falten resultats).");
        return;
      }
      await matchesRepo.bulkCreate(seasonId, event.id, next);
      await onChanged();
    } catch (err) {
      console.error(err);
      setError("No s'ha pogut generar la següent ronda.");
    } finally {
      setBusy(false);
    }
  }

  // Es pot finalitzar:
  //  - Si hi ha bracket complet: tots els matches decidits i ja hi ha hagut
  //    una final/single.
  //  - Si NO hi ha bracket: hi ha almenys 1 ronda jugada → tanquem només amb
  //    la classificació de punts.
  const canFinalizeWithBracket =
    bracketStarted &&
    matches.every((m) => m.winnerTeamId !== null || m.teamBId === null) &&
    matches.some((m) => m.phase === "final" || m.phase === "single");
  const canFinalizeNoBracket =
    !bracketStarted && pointsRounds.length > 0;
  const canFinalize =
    editable && (canFinalizeWithBracket || canFinalizeNoBracket);

  async function handleFinalize() {
    if (!canFinalize) return;
    const ok = await dialog.confirm({
      title: "Finalitzar esdeveniment",
      message:
        "Es calcularan i desaran les posicions i punts. Podràs reobrir-lo si cal.",
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
      const finalStandings = computePointsLeagueFinalStandings(
        teams,
        pointsRounds,
        matches
      );
      const attendanceByParticipant = Object.fromEntries(
        fullAttendance.map((a) => [a.participantId, a])
      );
      const breakdown = calculateEventPoints(
        finalStandings,
        teams,
        attendanceByParticipant
      );
      await eventsRepo.update(seasonId, event.id, {
        status: "finished",
        finalStandings,
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
        "Els punts es recalcularan quan el tornis a finalitzar. Vols continuar?",
      confirmLabel: "Reobrir",
    });
    if (!ok) return;
    try {
      await eventsRepo.update(seasonId, event.id, {
        status: "in_progress",
        finalStandings: [],
        pointsBreakdown: [],
      });
      await onChanged();
    } catch (err) {
      console.error(err);
      setError("No s'ha pogut reobrir l'esdeveniment.");
    }
  }

  if (teams.length === 0) {
    return (
      <div className="card card-pad text-sm muted">
        Encara no s'ha iniciat la competició. Ves a la pestanya{" "}
        <em>Equips</em> per afegir participants i començar.
      </div>
    );
  }

  // Iteradors de bracket-only per la UI inferior.
  const matchesByPhase = new Map<MatchPhase, Match[]>();
  for (const m of matches) {
    if (!matchesByPhase.has(m.phase)) matchesByPhase.set(m.phase, []);
    matchesByPhase.get(m.phase)!.push(m);
  }

  return (
    <div className="space-y-6">
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}

      {/* Rondes de puntuació */}
      <section className="card">
        <div className="card-header">
          <span>
            Rondes de puntuació <Badge tone="slate">{pointsRounds.length}</Badge>
          </span>
          {editable && !bracketStarted ? (
            <div className="flex flex-shrink-0 items-center gap-2">
              {pointsRounds.length > 0 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRemoveLastRound}
                  disabled={busy}
                >
                  Eliminar última
                </Button>
              ) : null}
              <Button size="sm" onClick={handleAddRound} disabled={busy}>
                Afegir ronda
              </Button>
            </div>
          ) : null}
        </div>
        <PointsLeagueScoresGrid
          seasonId={seasonId}
          eventId={event.id}
          teams={teams}
          rounds={pointsRounds}
          editable={editable && !bracketStarted}
          onChanged={onChanged}
        />
        {bracketStarted ? (
          <p className="px-4 py-3 text-xs italic subtle sm:px-6">
            Les rondes han quedat bloquejades en generar l'eliminatòria. Pots
            refer-la des de més avall.
          </p>
        ) : null}
      </section>

      {/* Setup del bracket (quan encara no s'ha generat) */}
      {editable && !bracketStarted ? (
        <section className="card card-pad space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest muted">
            Eliminatòria (opcional)
          </h2>
          <p className="text-sm muted">
            Tria amb quants classificats vols generar el bracket. Si en tries
            4, comença per semifinals; si 8, per quarts; etc.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Classificats">
              <Input
                type="number"
                inputMode="numeric"
                min={2}
                step={1}
                className="w-24"
                value={qualifierText}
                onChange={(e) => setQualifierText(e.target.value)}
              />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {QUALIFIER_PRESETS.filter((q) => q <= teams.length).map((q) => (
                <Button
                  key={q}
                  variant="secondary"
                  size="sm"
                  onClick={() => setQualifierText(String(q))}
                >
                  Top {q}
                </Button>
              ))}
            </div>
            <Button
              onClick={handleGenerateBracket}
              disabled={busy || pointsRounds.length === 0}
            >
              {busy ? "Generant…" : "Generar bracket"}
            </Button>
          </div>
          {pointsRounds.length === 0 ? (
            <p className="text-xs italic subtle">
              Cal almenys una ronda jugada per poder generar el bracket.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Bracket existent: render simple amb advance/finalize */}
      {bracketStarted ? (
        <>
          {PHASE_ORDER.map((phase) => {
            const list = matchesByPhase.get(phase);
            if (!list || list.length === 0) return null;
            return (
              <section key={phase} className="card">
                <div className="card-header">
                  <span>{PHASE_LABELS[phase]}</span>
                  <span className="text-xs font-normal subtle">
                    {list.length} partit{list.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="card-divide">
                  {list
                    .slice()
                    .sort((a, b) => (a.round ?? 0) - (b.round ?? 0))
                    .map((m) => (
                      <BracketMatchRow
                        key={m.id}
                        match={m}
                        teamById={teamById}
                        editable={editable}
                        onSetWinner={(winner) => handleSetWinner(m, winner)}
                      />
                    ))}
                </ul>
              </section>
            );
          })}
        </>
      ) : null}

      {/* Botoneres d'acció */}
      {editable ? (
        <section className="card flex flex-wrap items-center gap-3 card-pad">
          {canAdvanceBracket ? (
            <Button onClick={handleAdvanceBracket} disabled={busy}>
              Avançar a la següent ronda
            </Button>
          ) : null}
          {canFinalize ? (
            <Button
              variant="primary"
              size="lg"
              onClick={handleFinalize}
              disabled={busy}
            >
              {bracketStarted
                ? "🏆 Finalitzar i calcular punts"
                : "🏆 Finalitzar només per puntuació"}
            </Button>
          ) : null}
          {bracketStarted ? (
            <Button
              variant="danger"
              size="sm"
              onClick={handleResetBracket}
              disabled={busy}
            >
              Refer l'eliminatòria
            </Button>
          ) : null}
          {!canAdvanceBracket && !canFinalize && bracketStarted ? (
            <p className="text-sm muted">
              Introdueix els resultats per poder avançar.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Resum final */}
      {event.status === "finished" ? (
        <PointsLeagueFinalSummary
          data={data}
          standings={standings}
          onReopen={readOnly ? undefined : handleReopen}
        />
      ) : null}

      {/* Hint contextual per a la propera ronda de bracket */}
      {!bracketStarted && editable && pointsRounds.length > 0 ? (
        <BracketHint qualifierText={qualifierText} teamCount={teams.length} />
      ) : null}
    </div>
  );
}

function BracketHint({
  qualifierText,
  teamCount,
}: {
  qualifierText: string;
  teamCount: number;
}) {
  const x = Number(qualifierText);
  if (!Number.isInteger(x) || x < 2 || x > teamCount) return null;
  const p = nextPowerOfTwo(x);
  const totalRounds = Math.log2(p);
  const phase = phaseForRoundsToFinal(totalRounds - 1);
  const PHASE_TO_LABEL: Record<MatchPhase, string> = PHASE_LABELS;
  return (
    <p className="text-xs muted">
      Amb {x} classificats el bracket comença per{" "}
      <strong className="text-slate-900 dark:text-white">
        {PHASE_TO_LABEL[phase]}
      </strong>
      {p !== x ? ` (${p - x} byes)` : ""}.
    </p>
  );
}

function BracketMatchRow({
  match,
  teamById,
  editable,
  onSetWinner,
}: {
  match: Match;
  teamById: Map<string, Team>;
  editable: boolean;
  onSetWinner: (winnerTeamId: string | null) => void;
}) {
  const teamA = match.teamAId ? teamById.get(match.teamAId) : null;
  const teamB = match.teamBId ? teamById.get(match.teamBId) : null;
  const isBye = match.teamBId === null;

  return (
    <li className="px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <BracketLine
            name={teamA?.name ?? "—"}
            isWinner={match.winnerTeamId === match.teamAId}
          />
          {isBye ? (
            <p className="text-xs italic subtle">Bye (passa directament)</p>
          ) : (
            <BracketLine
              name={teamB?.name ?? "—"}
              isWinner={match.winnerTeamId === match.teamBId}
            />
          )}
        </div>
        {!isBye && editable ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={
                match.winnerTeamId === match.teamAId ? "primary" : "secondary"
              }
              size="sm"
              onClick={() => onSetWinner(match.teamAId)}
            >
              Guanya {teamA?.name ?? "A"}
            </Button>
            <Button
              variant={
                match.winnerTeamId === match.teamBId ? "primary" : "secondary"
              }
              size="sm"
              onClick={() => onSetWinner(match.teamBId)}
            >
              Guanya {teamB?.name ?? "B"}
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function BracketLine({ name, isWinner }: { name: string; isWinner: boolean }) {
  return (
    <p
      className={`flex items-center gap-1.5 text-sm ${
        isWinner
          ? "font-semibold text-emerald-700 dark:text-emerald-400"
          : "text-slate-700 dark:text-slate-300"
      }`}
    >
      {isWinner ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : null}
      {name}
    </p>
  );
}

function PointsLeagueFinalSummary({
  data,
  standings,
  onReopen,
}: {
  data: EventData;
  standings: ReturnType<typeof computePointsLeagueStandings>;
  onReopen?: () => void;
}) {
  const { event, teams, participants } = data;
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const participantById = new Map(participants.map((p) => [p.id, p]));
  const totalsByTeam = new Map(standings.map((s) => [s.teamId, s.total]));

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

        {event.finalStandings && event.finalStandings.length > 0 ? (
          <div className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-800 dark:text-emerald-300">
              Classificació final
            </h3>
            <ol className="space-y-1.5 text-sm">
              {event.finalStandings.map((s, idx) => (
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
                    {s.teamIds
                      .map((tid) => {
                        const name = teamById.get(tid)?.name ?? tid;
                        const pts = totalsByTeam.get(tid);
                        return pts != null ? `${name} (${pts} pts)` : name;
                      })
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
                  <th className="py-2 text-center">Punts pos.</th>
                  <th className="py-2 text-center">Bonus assist.</th>
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
