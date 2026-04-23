import { useEffect, useMemo, useState } from "react";
import { Button, ErrorMessage } from "@/ui/forms";
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

  // Bracket: ronda actual = màxima ronda present, excloent group phase.
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
    currentRoundMatches.length > 0 &&
    areAllMatchesDecided(currentRoundMatches);

  const hasFinalMatch = currentRoundMatches.some((m) => m.phase === "final" || m.phase === "single");
  const canAdvanceBracket =
    editable &&
    currentRoundMatches.length > 1 &&
    currentRoundComplete &&
    !hasFinalMatch;

  // Fase de grups: detectem si tots els matches de group són decidits.
  // Envoltat en useMemo per estabilitzar la referència (alimenta useMemo
  // de defaultQualifiers més avall).
  const groupMatches = useMemo(
    () => matchesByPhase.get("group") ?? [],
    [matchesByPhase]
  );
  const hasGroupStage = groupMatches.length > 0;
  const groupStageComplete = hasGroupStage && areAllMatchesDecided(groupMatches);
  const bracketStarted = matches.some((m) => m.phase !== "group");
  const canBuildBracketFromGroups =
    editable && hasGroupStage && groupStageComplete && !bracketStarted;

  // Selecció lliure de qualificats: per defecte agafem els top N de cada grup
  // (segons event.config.qualifiersPerGroup), però l'admin pot afegir/treure
  // equips manualment. Això permet, per exemple, escollir "1r de cada grup + un
  // 2n" quan hi ha 3 grups i falta temps per jugar semis+quarts complets.
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
  // Si ja no estem en fase de selecció (bracket construït o no aplicable),
  // netegem la selecció custom per si més tard es reobre.
  useEffect(() => {
    if (!canBuildBracketFromGroups) setCustomQualifiers(null);
  }, [canBuildBracketFromGroups]);

  // Envoltat en useMemo perquè `new Set(...)` genera una referència nova
  // a cada render i desestabilitzava `startPhaseLabel`.
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
    editable && allDecided && hasFinalMatch && currentRoundMatches.every((m) => m.winnerTeamId);

  async function handleSetWinner(m: Match, winnerTeamId: string | null, opts?: {
    scoreA?: number;
    scoreB?: number;
  }) {
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
      // La pestanya d'Assistència mostra "Present · +5" com a estat per defecte.
      // Si l'admin no ha editat cap fila, no s'ha desat res a Firestore i el
      // desglossament de punts acabaria amb bonus 0 per aquests participants.
      // Abans de calcular els punts, persistim un registre d'assistència amb
      // els valors per defecte per a cada participant elegible que encara no
      // en tingui un (lògica al mòdul de domini + orquestració al repo).
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
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Encara no s'ha iniciat la competició. Ves a la tab <em>Equips</em> per
        crear equips i començar.
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
          <section
            key={phase}
            className="rounded-lg border border-slate-200 bg-white"
          >
            <h2 className="border-b border-slate-100 px-6 py-3 text-sm font-semibold text-slate-900">
              {PHASE_LABELS[phase]}
            </h2>
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
              <ul className="divide-y divide-slate-100">
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
        <section className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-6">
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
                <span className="text-xs text-slate-500">
                  Comença per <strong>{startPhaseLabel}</strong>
                  {nextPowerOfTwo(selectedQualifiers.size) !== selectedQualifiers.size
                    ? ` (${
                        nextPowerOfTwo(selectedQualifiers.size) - selectedQualifiers.size
                      } byes)`
                    : ""}
                </span>
              ) : (
                <span className="text-xs text-slate-500">
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
            >
              {finalizing ? "Finalitzant…" : "Finalitzar i calcular punts"}
            </Button>
          ) : null}
          {!canBuildBracketFromGroups && !canAdvanceBracket && !canFinalize ? (
            <p className="text-sm text-slate-500">
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
    <li className="px-6 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1">
          <TeamLine
            name={teamA?.name ?? "—"}
            isWinner={match.winnerTeamId === match.teamAId}
          />
          {isBye ? (
            <p className="text-xs italic text-slate-500">Bye (passa directament)</p>
          ) : (
            <TeamLine
              name={teamB?.name ?? "—"}
              isWinner={match.winnerTeamId === match.teamBId}
            />
          )}
        </div>
        {!isBye && editable ? (
          <div className="flex items-center gap-2">
            <Button
              variant={match.winnerTeamId === match.teamAId ? "primary" : "secondary"}
              onClick={() => onSetWinner(match.teamAId)}
              disabled={busy}
            >
              Guanya {teamA?.name ?? "A"}
            </Button>
            <Button
              variant={match.winnerTeamId === match.teamBId ? "primary" : "secondary"}
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
    <p className={`text-sm ${isWinner ? "font-semibold text-emerald-700" : "text-slate-700"}`}>
      {isWinner ? "✓ " : ""}
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
  /** Si true, mostra una casella per escollir manualment els equips que passen. */
  selectionMode: boolean;
  selectedQualifiers: Set<string>;
  onToggleQualifier: (teamId: string) => void;
}) {
  // Agrupar per groupId
  const byGroup = new Map<string, Match[]>();
  for (const m of matches) {
    const gid = m.groupId ?? "group_?";
    if (!byGroup.has(gid)) byGroup.set(gid, []);
    byGroup.get(gid)!.push(m);
  }
  const groupIds = [...byGroup.keys()].sort();

  return (
    <div className="divide-y divide-slate-100">
      {groupIds.map((gid) => {
        const gMatches = byGroup.get(gid)!;
        const groupTeams = teams.filter((t) => t.groupId === gid);
        const standings = groupTeams.length > 0
          ? groupStandings({ id: gid, teamIds: groupTeams.map((t) => t.id) }, gMatches)
          : [];
        return (
          <div key={gid} className="px-6 py-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Grup {gid.replace("group_", "")}
            </h3>
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
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
                  <li key={m.id} className="px-4 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <TeamLine
                          name={teamA?.name ?? "—"}
                          isWinner={m.winnerTeamId === m.teamAId}
                        />
                        <TeamLine
                          name={teamB?.name ?? "—"}
                          isWinner={m.winnerTeamId === m.teamBId}
                        />
                        {isDraw ? (
                          <p className="text-xs italic text-slate-500">Empat</p>
                        ) : null}
                      </div>
                      {editable ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant={m.winnerTeamId === m.teamAId ? "primary" : "secondary"}
                            onClick={() => onSetResult(m, m.teamAId)}
                            disabled={busy}
                          >
                            Guanya {teamA?.name ?? "A"}
                          </Button>
                          <Button
                            variant={m.winnerTeamId === m.teamBId ? "primary" : "secondary"}
                            onClick={() => onSetResult(m, m.teamBId)}
                            disabled={busy}
                          >
                            Guanya {teamB?.name ?? "B"}
                          </Button>
                          <Button
                            variant={isDraw ? "primary" : "secondary"}
                            onClick={() =>
                              onSetResult(m, null, { scoreA: 1, scoreB: 1 })
                            }
                            disabled={busy}
                          >
                            Empat
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            {standings.length > 0 ? (
              <table className="w-full text-xs">
                <thead className="text-slate-500">
                  <tr>
                    {selectionMode ? (
                      <th className="w-10 text-center" title="Passa a l'eliminatòria">
                        Passa
                      </th>
                    ) : null}
                    <th className="text-left">Equip</th>
                    <th>PJ</th>
                    <th>G</th>
                    <th>E</th>
                    <th>P</th>
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s) => (
                    <tr key={s.teamId} className="text-slate-700">
                      {selectionMode ? (
                        <td className="text-center">
                          <input
                            type="checkbox"
                            checked={selectedQualifiers.has(s.teamId)}
                            onChange={() => onToggleQualifier(s.teamId)}
                            aria-label={`Passa ${teamById.get(s.teamId)?.name ?? s.teamId}`}
                          />
                        </td>
                      ) : null}
                      <td>{teamById.get(s.teamId)?.name ?? s.teamId}</td>
                      <td className="text-center">{s.played}</td>
                      <td className="text-center">{s.wins}</td>
                      <td className="text-center">{s.draws}</td>
                      <td className="text-center">{s.losses}</td>
                      <td className="text-center font-semibold">{s.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-emerald-900">
          Esdeveniment finalitzat
        </h2>
        {onReopen ? (
          <Button variant="secondary" onClick={onReopen}>
            Reobrir
          </Button>
        ) : null}
      </div>

      {event.finalStandings && event.finalStandings.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-emerald-800">
            Classificació
          </h3>
          <ol className="space-y-1 text-sm text-slate-800">
            {event.finalStandings.map((s) => (
              <li key={s.position}>
                <strong>{s.position}.</strong>{" "}
                {s.teamIds.map((tid) => teamById.get(tid)?.name ?? tid).join(", ")}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {event.pointsBreakdown && event.pointsBreakdown.length > 0 ? (
        <div className="overflow-x-auto">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-emerald-800">
            Punts per participant
          </h3>
          <table className="min-w-full text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="text-left">Participant</th>
                <th>Posició</th>
                <th>Bonus</th>
                <th>Penalització</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-100">
              {event.pointsBreakdown
                .slice()
                .sort((a, b) => b.total - a.total)
                .map((b) => (
                  <tr key={b.participantId} className="text-slate-700">
                    <td>{participantById.get(b.participantId)?.name ?? b.participantId}</td>
                    <td className="text-center">{b.positionPoints}</td>
                    <td className="text-center">{b.bonusPoints}</td>
                    <td className="text-center">{b.penaltyPoints}</td>
                    <td className="text-center font-semibold">{b.total}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

/** Selecciona els qualificats per defecte segons standings de cada grup (top N). */
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
