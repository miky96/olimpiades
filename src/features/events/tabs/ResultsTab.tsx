import { useEffect, useMemo, useState } from "react";
import { Badge, Button, ErrorMessage } from "@/ui/forms";
import { attendanceRepo, eventsRepo, matchesRepo } from "@/data";
import type { Match, MatchPhase, Team } from "@/domain/types";
import {
  advanceBracket,
  areAllMatchesDecided,
  calculateEventPoints,
  computeFinalStandings,
  generateFirstRoundBracket,
  groupStandings,
  nextPowerOfTwo,
  phaseForRoundsToFinal,
} from "@/domain";
import { useSeasons } from "@/features/seasons/useSeasons";
import type { EventData } from "../EventDetailPage";

interface Props {
  data: EventData;
  readOnly: boolean;
  onChanged: () => Promise<void> | void;
}

const PHASE_ORDER: MatchPhase[] = [
  "group",
  "round_of_16",
  "quarter",
  "semi",
  "final",
  "third_place",
  "single",
];

const PHASE_LABELS: Record<MatchPhase, string> = {
  group: "Fase de grups",
  round_of_16: "Vuitens",
  quarter: "Quarts",
  semi: "Semifinals",
  final: "Final",
  third_place: "Tercer i quart",
  single: "Partit únic",
};

export function ResultsTab({ data, readOnly, onChanged }: Props) {
  const { currentSeason } = useSeasons();
  const { event, matches, teams, attendance, participants } = data;
  const seasonId = currentSeason?.id ?? "";
  const editable = !readOnly && event.status === "in_progress";

  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );

  const matchesByPhase = useMemo(() => {
    const groups = new Map<MatchPhase, Match[]>();
    for (const m of matches) {
      if (!groups.has(m.phase)) groups.set(m.phase, []);
      groups.get(m.phase)!.push(m);
    }
    return groups;
  }, [matches]);

  const currentBracketRound = useMemo(() => {
    let max = 0;
    for (const m of matches) {
      if (m.phase === "group") continue;
      if ((m.round ?? 0) > max) max = m.round ?? 0;
    }
    return max;
  }, [matches]);

  const currentRoundMatches = useMemo(
    () =>
      matches.filter(
        (m) => m.phase !== "group" && (m.round ?? 0) === currentBracketRound
      ),
    [matches, currentBracketRound]
  );

  const currentRoundComplete =
    currentRoundMatches.length > 0 && areAllMatchesDecided(currentRoundMatches);

  const hasFinalMatch = currentRoundMatches.some(
    (m) => m.phase === "final" || m.phase === "single"
  );
  const canAdvanceBracket =
    editable &&
    currentRoundMatches.length > 1 &&
    currentRoundComplete &&
    !hasFinalMatch;

  const groupMatches = useMemo(
    () => matchesByPhase.get("group") ?? [],
    [matchesByPhase]
  );
  const hasGroupStage = groupMatches.length > 0;
  const groupStageComplete = hasGroupStage && areAllMatchesDecided(groupMatches);
  const bracketStarted = matches.some((m) => m.phase !== "group");
  const canBuildBracketFromGroups =
    editable && hasGroupStage && groupStageComplete && !bracketStarted;

  const defaultQualifiers = useMemo(() => {
    if (!canBuildBracketFromGroups) return [] as string[];
    return pickQualifiers(
      teams,
      groupMatches,
      event.config.qualifiersPerGroup ?? 2
    );
  }, [canBuildBracketFromGroups, teams, groupMatches, event.config.qualifiersPerGroup]);

  const [customQualifiers, setCustomQualifiers] = useState<Set<string> | null>(
    null
  );
  useEffect(() => {
    if (!canBuildBracketFromGroups) setCustomQualifiers(null);
  }, [canBuildBracketFromGroups]);

  const selectedQualifiers = useMemo(
    () => customQualifiers ?? new Set(defaultQualifiers),
    [customQualifiers, defaultQualifiers]
  );

  function toggleQualifier(teamId: string) {
    const next = new Set(selectedQualifiers);
    if (next.has(teamId)) next.delete(teamId);
    else next.add(teamId);
    setCustomQualifiers(next);
  }

  const startPhaseLabel = useMemo(() => {
    const n = selectedQualifiers.size;
    if (n < 2) return null;
    const p = nextPowerOfTwo(n);
    const totalRounds = Math.log2(p);
    const phase = phaseForRoundsToFinal(totalRounds - 1);
    return PHASE_LABELS[phase];
  }, [selectedQualifiers]);

  const allDecided = matches.length > 0 && areAllMatchesDecided(matches);
  const canFinalize =
    editable &&
    allDecided &&
    hasFinalMatch &&
    currentRoundMatches.every((m) => m.winnerTeamId);

  async function handleSetWinner(
    m: Match,
    winnerTeamId: string | null,
    opts?: { scoreA?: number; scoreB?: number }
  ) {
    if (!editable) return;
    setBusyMatchId(m.id);
    setError(null);
    try {
      await matchesRepo.setResult(seasonId, event.id, m.id, {
        winnerTeamId,
        scoreA: opts?.scoreA,
        scoreB: opts?.scoreB,
      });
      await onChanged();
    } catch (err) {
      console.error(err);
      setError("No s'ha pogut desar el resultat.");
    } finally {
      setBusyMatchId(null);
    }
  }

  async function handleAdvanceBracket() {
    if (!canAdvanceBracket) return;
    setAdvancing(true);
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
      setAdvancing(false);
    }
  }

  async function handleBuildBracketFromGroups() {
    if (!canBuildBracketFromGroups) return;
    setAdvancing(true);
    setError(null);
    try {
      const qualifiers = [...selectedQualifiers];
      if (qualifiers.length < 2) {
        setError("Calen almenys 2 equips qualificats per construir el bracket.");
        return;
      }
      const bracketMatches = generateFirstRoundBracket(qualifiers, {
        eventId: event.id,
      });
      await matchesRepo.bulkCreate(seasonId, event.id, bracketMatches);
      await onChanged();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "No s'ha pogut generar el bracket."
      );
    } finally {
      setAdvancing(false);
    }
  }

  async function handleFinalize() {
    if (!canFinalize) return;
    const ok = window.confirm(
      "Finalitzar l'esdeveniment? Es calcularan i desaran les posicions i punts."
    );
    if (!ok) return;
    setFinalizing(true);
    setError(null);
    try {
      const fullAttendance = await attendanceRepo.ensureDefaults(
        seasonId,
        event.id,
        { participants, existing: attendance }
      );

      const standings = computeFinalStandings(
        teams.map((t) => t.id),
        matches
      );
      const attendanceByParticipant = Object.fromEntries(
        fullAttendance.map((a) => [a.participantId, a])
      );
      const breakdown = calculateEventPoints(
        standings,
        teams,
        attendanceByParticipant
      );
      await eventsRepo.update(seasonId, event.id, {
        status: "finished",
        finalStandings: standings,
        pointsBreakdown: breakdown,
      });
      await onChanged();
    } catch (err) {
      console.error(err);
      setError("No s'ha pogut finalitzar l'esdeveniment.");
    } finally {
      setFinalizing(false);
    }
  }

  async function handleReopen() {
    if (readOnly) return;
    const ok = window.confirm(
      "Reobrir l'esdeveniment? Els punts es recalcularan quan el tornis a finalitzar."
    );
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

  if (matches.length === 0) {
    return (
      <div className="card card-pad text-sm muted">
        Encara no s'ha iniciat la competició. Ves a la pestanya{" "}
        <em>Equips</em> per crear equips i començar.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}

      {PHASE_ORDER.map((phase) => {
        const list = matchesByPhase.get(phase);
        if (!list || list.length === 0) return null;
        return (
          <section key={phase} className="card">
            <div className="card-header">
              <span>{PHASE_LABELS[phase]}</span>
              {phase !== "group" ? (
                <span className="text-xs font-normal subtle">
                  {list.length} partit{list.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
            {phase === "group" ? (
              <GroupPhaseView
                matches={list}
                teams={teams}
                teamById={teamById}
                editable={editable}
                busyMatchId={busyMatchId}
                onSetResult={handleSetWinner}
                selectionMode={canBuildBracketFromGroups}
                selectedQualifiers={selectedQualifiers}
                onToggleQualifier={toggleQualifier}
              />
            ) : (
              <ul className="card-divide">
                {list
                  .slice()
                  .sort((a, b) => (a.round ?? 0) - (b.round ?? 0))
                  .map((m) => (
                    <MatchRow
                      key={m.id}
                      match={m}
                      teamById={teamById}
                      editable={editable}
                      busy={busyMatchId === m.id}
                      onSetWinner={(winner) => handleSetWinner(m, winner)}
                    />
                  ))}
              </ul>
            )}
          </section>
        );
      })}

      {editable ? (
        <section className="card flex flex-wrap items-center gap-3 card-pad">
          {canBuildBracketFromGroups ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleBuildBracketFromGroups}
                disabled={advancing || selectedQualifiers.size < 2}
              >
                {advancing
                  ? "Generant…"
                  : `Generar bracket amb ${selectedQualifiers.size} equip${
                      selectedQualifiers.size === 1 ? "" : "s"
                    }`}
              </Button>
              {selectedQualifiers.size >= 2 && startPhaseLabel ? (
                <span className="text-xs muted">
                  Comença per{" "}
                  <strong className="text-slate-900 dark:text-white">
                    {startPhaseLabel}
                  </strong>
                  {nextPowerOfTwo(selectedQualifiers.size) !==
                  selectedQualifiers.size
                    ? ` (${
                        nextPowerOfTwo(selectedQualifiers.size) -
                        selectedQualifiers.size
                      } byes)`
                    : ""}
                </span>
              ) : (
                <span className="text-xs muted">
                  Selecciona almenys 2 equips a les classificacions.
                </span>
              )}
            </div>
          ) : null}
          {canAdvanceBracket ? (
            <Button onClick={handleAdvanceBracket} disabled={advancing}>
              {advancing ? "Avançant…" : "Avançar a la següent ronda"}
            </Button>
          ) : null}
          {canFinalize ? (
            <Button
              variant="primary"
              onClick={handleFinalize}
              disabled={finalizing}
              size="lg"
            >
              {finalizing ? "Finalitzant…" : "🏆 Finalitzar i calcular punts"}
            </Button>
          ) : null}
          {!canBuildBracketFromGroups &&
          !canAdvanceBracket &&
          !canFinalize ? (
            <p className="text-sm muted">
              Introdueix els resultats per poder avançar.
            </p>
          ) : null}
        </section>
      ) : null}

      {event.status === "finished" ? (
        <FinalSummary data={data} onReopen={readOnly ? undefined : handleReopen} />
      ) : null}
    </div>
  );
}

function MatchRow({
  match,
  teamById,
  editable,
  busy,
  onSetWinner,
}: {
  match: Match;
  teamById: Map<string, Team>;
  editable: boolean;
  busy: boolean;
  onSetWinner: (winnerTeamId: string | null) => void;
}) {
  const teamA = match.teamAId ? teamById.get(match.teamAId) : null;
  const teamB = match.teamBId ? teamById.get(match.teamBId) : null;
  const isBye = match.teamBId === null;

  return (
    <li className="px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <TeamLine
            name={teamA?.name ?? "—"}
            isWinner={match.winnerTeamId === match.teamAId}
          />
          {isBye ? (
            <p className="text-xs italic subtle">Bye (passa directament)</p>
          ) : (
            <TeamLine
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
              disabled={busy}
            >
              Guanya {teamA?.name ?? "A"}
            </Button>
            <Button
              variant={
                match.winnerTeamId === match.teamBId ? "primary" : "secondary"
              }
              size="sm"
              onClick={() => onSetWinner(match.teamBId)}
              disabled={busy}
            >
              Guanya {teamB?.name ?? "B"}
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function TeamLine({ name, isWinner }: { name: string; isWinner: boolean }) {
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

function GroupPhaseView({
  matches,
  teams,
  teamById,
  editable,
  busyMatchId,
  onSetResult,
  selectionMode,
  selectedQualifiers,
  onToggleQualifier,
}: {
  matches: Match[];
  teams: Team[];
  teamById: Map<string, Team>;
  editable: boolean;
  busyMatchId: string | null;
  onSetResult: (
    m: Match,
    winnerTeamId: string | null,
    opts?: { scoreA?: number; scoreB?: number }
  ) => void;
  selectionMode: boolean;
  selectedQualifiers: Set<string>;
  onToggleQualifier: (teamId: string) => void;
}) {
  const byGroup = new Map<string, Match[]>();
  for (const m of matches) {
    const gid = m.groupId ?? "group_?";
    if (!byGroup.has(gid)) byGroup.set(gid, []);
    byGroup.get(gid)!.push(m);
  }
  const groupIds = [...byGroup.keys()].sort();

  return (
    <div className="card-divide">
      {groupIds.map((gid) => {
        const gMatches = byGroup.get(gid)!;
        const groupTeams = teams.filter((t) => t.groupId === gid);
        const standings =
          groupTeams.length > 0
            ? groupStandings(
                { id: gid, teamIds: groupTeams.map((t) => t.id) },
                gMatches
              )
            : [];
        return (
          <div key={gid} className="space-y-3 px-4 py-4 sm:px-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                {gid.replace("group_", "").toUpperCase()}
              </span>
              Grup {gid.replace("group_", "").toUpperCase()}
            </h3>
            <ul className="divide-y divide-slate-200/70 overflow-hidden rounded-xl border border-slate-200/70 dark:divide-slate-800/70 dark:border-slate-800/70">
              {gMatches.map((m) => {
                const teamA = m.teamAId ? teamById.get(m.teamAId) : null;
                const teamB = m.teamBId ? teamById.get(m.teamBId) : null;
                const busy = busyMatchId === m.id;
                const isDraw =
                  m.winnerTeamId === null &&
                  m.scoreA != null &&
                  m.scoreB != null &&
                  m.scoreA === m.scoreB;
                return (
                  <li
                    key={m.id}
                    className="bg-white px-3 py-2 text-sm dark:bg-slate-900/60"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <TeamLine
                          name={teamA?.name ?? "—"}
                          isWinner={m.winnerTeamId === m.teamAId}
                        />
                        <TeamLine
                          name={teamB?.name ?? "—"}
                          isWinner={m.winnerTeamId === m.teamBId}
                        />
                        {isDraw ? (
                          <p className="text-xs italic subtle">Empat</p>
                        ) : null}
                      </div>
                      {editable ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            variant={
                              m.winnerTeamId === m.teamAId
                                ? "primary"
                                : "secondary"
                            }
                            size="sm"
                            onClick={() => onSetResult(m, m.teamAId)}
                            disabled={busy}
                          >
                            {teamA?.name ?? "A"}
                          </Button>
                          <Button
                            variant={isDraw ? "primary" : "secondary"}
                            size="sm"
                            onClick={() =>
                              onSetResult(m, null, { scoreA: 1, scoreB: 1 })
                            }
                            disabled={busy}
                          >
                            Empat
                          </Button>
                          <Button
                            variant={
                              m.winnerTeamId === m.teamBId
                                ? "primary"
                                : "secondary"
                            }
                            size="sm"
                            onClick={() => onSetResult(m, m.teamBId)}
                            disabled={busy}
                          >
                            {teamB?.name ?? "B"}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            {standings.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800/70">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50/80 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
                    <tr>
                      {selectionMode ? (
                        <th className="w-10 px-2 py-2 text-center" title="Passa">
                          Passa
                        </th>
                      ) : null}
                      <th className="px-2 py-2">Equip</th>
                      <th className="px-2 py-2 text-center">PJ</th>
                      <th className="px-2 py-2 text-center">G</th>
                      <th className="px-2 py-2 text-center">E</th>
                      <th className="px-2 py-2 text-center">P</th>
                      <th className="px-2 py-2 text-center">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                    {standings.map((s) => {
                      const selected = selectedQualifiers.has(s.teamId);
                      return (
                        <tr
                          key={s.teamId}
                          className={
                            selectionMode && selected
                              ? "bg-brand-50/50 text-slate-800 dark:bg-brand-500/10 dark:text-slate-200"
                              : "text-slate-700 dark:text-slate-300"
                          }
                        >
                          {selectionMode ? (
                            <td className="px-2 py-1.5 text-center">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => onToggleQualifier(s.teamId)}
                                aria-label={`Passa ${
                                  teamById.get(s.teamId)?.name ?? s.teamId
                                }`}
                                className="h-4 w-4 accent-brand-600"
                              />
                            </td>
                          ) : null}
                          <td className="px-2 py-1.5 font-medium">
                            {teamById.get(s.teamId)?.name ?? s.teamId}
                          </td>
                          <td className="px-2 py-1.5 text-center">{s.played}</td>
                          <td className="px-2 py-1.5 text-center">{s.wins}</td>
                          <td className="px-2 py-1.5 text-center">{s.draws}</td>
                          <td className="px-2 py-1.5 text-center">{s.losses}</td>
                          <td className="px-2 py-1.5 text-center font-bold text-brand-700 dark:text-brand-300">
                            {s.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function FinalSummary({
  data,
  onReopen,
}: {
  data: EventData;
  onReopen?: () => void;
}) {
  const { event, teams, participants } = data;
  const teamById = new Map(teams.map((t) => [t.id, t]));
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

        {event.finalStandings && event.finalStandings.length > 0 ? (
          <div className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-800 dark:text-emerald-300">
              Classificació
            </h3>
            <ol className="space-y-1.5 text-sm">
              {event.finalStandings.map((s, idx) => (
                <li key={s.position} className="flex items-center gap-2">
                  <Badge
                    tone={idx === 0 ? "amber" : idx === 1 ? "slate" : idx === 2 ? "rose" : "slate"}
                  >
                    {s.position}
                  </Badge>
                  <span className="text-slate-800 dark:text-slate-200">
                    {s.teamIds
                      .map((tid) => teamById.get(tid)?.name ?? tid)
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
                  <th className="py-2 text-center">Punts guanyats</th>
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

function pickQualifiers(
  teams: Team[],
  groupMatches: Match[],
  qualifiersPerGroup: number
): string[] {
  const byGroup = new Map<string, string[]>();
  for (const t of teams) {
    if (!t.groupId) continue;
    if (!byGroup.has(t.groupId)) byGroup.set(t.groupId, []);
    byGroup.get(t.groupId)!.push(t.id);
  }

  const qualifiers: string[] = [];
  for (const [gid, teamIds] of byGroup) {
    const standings = groupStandings({ id: gid, teamIds }, groupMatches);
    for (let i = 0; i < qualifiersPerGroup && i < standings.length; i++) {
      qualifiers.push(standings[i].teamId);
    }
  }
  return qualifiers;
}
