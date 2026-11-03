import { useMemo, useState } from "react";
import { Badge, Button, ErrorMessage, Select } from "@/ui/forms";
import { useDialog } from "@/ui/dialog/useDialog";
import { attendanceRepo, eventsRepo } from "@/data";
import {
  DEFAULT_SCORE_ORDER,
  calculateEventPoints,
  computeScoreRankingStandings,
  getSingleScoreRound,
  isIndividualMode,
  onlyKnownParticipants,
  rankScoreRows,
  scoreOrderLabels,
  teamsWithoutScore,
  type ScoreOrder,
} from "@/domain";
import { useSeasons } from "@/features/seasons/useSeasons";
import type { EventData } from "../../EventDetailPage";
import { FinalSummary } from "../FinalSummary";
import { ScoreInput } from "./ScoreInput";
import { saveScoreRankingScore } from "./scoreRankingActions";

interface Props {
  data: EventData;
  readOnly: boolean;
  onChanged: () => Promise<void> | void;
}

/**
 * Resultats del format `score_ranking`: una sola prova on cada competidor
 * rep una puntuació. La classificació resultant és la de l'esdeveniment.
 */
export function ScoreRankingView({ data, readOnly, onChanged }: Props) {
  const dialog = useDialog();
  const { currentSeason } = useSeasons();
  const { event, teams, participants, attendance, pointsRounds } = data;
  const seasonId = currentSeason?.id ?? "";
  const editable = !readOnly && event.status === "in_progress";
  const individual = isIndividualMode(event.format, event.config);
  const order: ScoreOrder = event.config.scoreOrder ?? DEFAULT_SCORE_ORDER;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const round = getSingleScoreRound(pointsRounds);
  const scores = useMemo(() => round?.scores ?? {}, [round]);
  const rows = useMemo(
    () => rankScoreRows(teams, scores, order),
    [teams, scores, order]
  );
  // Mentre s'edita mantenim l'ordre fix (el d'afegit) perquè les files no
  // saltin en desar cada puntuació; un cop finalitzat, per posició.
  const displayRows = useMemo(() => {
    if (!editable) return rows;
    const byTeam = new Map(rows.map((r) => [r.teamId, r]));
    return teams
      .map((t) => byTeam.get(t.id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
  }, [editable, rows, teams]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const participantById = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants]
  );
  const missing = teamsWithoutScore(teams, scores);
  const scoredCount = teams.length - missing.length;
  const canFinalize = editable && scoredCount >= 2;

  async function handleScore(teamId: string, value: number | null) {
    setError(null);
    try {
      await saveScoreRankingScore({
        seasonId,
        eventId: event.id,
        round,
        teamId,
        value,
      });
      await onChanged();
    } catch (err) {
      console.error(err);
      setError("No s'ha pogut desar la puntuació.");
      throw err;
    }
  }

  async function handleOrderChange(next: ScoreOrder) {
    if (!editable || next === order) return;
    try {
      await eventsRepo.update(seasonId, event.id, {
        config: { ...event.config, scoreOrder: next },
      });
      await onChanged();
    } catch (err) {
      console.error(err);
      setError("No s'ha pogut canviar l'ordre de classificació.");
    }
  }

  async function handleFinalize() {
    if (!canFinalize) return;
    const ok = await dialog.confirm({
      title: "Finalitzar esdeveniment",
      message:
        missing.length > 0
          ? `Hi ha ${missing.length} ${individual ? "participant" : "equip"}${
              missing.length === 1 ? "" : "s"
            } sense puntuació: no rebran punts de posició. Es calcularan i desaran les posicions i punts. Podràs reobrir-lo si cal.`
          : "Es calcularan i desaran les posicions i punts. Podràs reobrir-lo si cal.",
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
      const standings = computeScoreRankingStandings(teams, scores, order);
      const attendanceByParticipant = Object.fromEntries(
        fullAttendance.map((a) => [a.participantId, a])
      );
      const breakdown = onlyKnownParticipants(
        calculateEventPoints(standings, teams, attendanceByParticipant),
        participants
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

  if (event.status === "draft" || teams.length === 0) {
    return (
      <div className="card card-pad text-sm muted">
        Encara no s'ha iniciat la competició. Ves a la pestanya{" "}
        <em>Equips</em> per crear {individual ? "els participants" : "els equips"}{" "}
        i començar.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}

      <section className="card">
        <div className="card-header flex-wrap gap-2">
          <span>
            Classificació{" "}
            <Badge tone="slate">
              {scoredCount}/{teams.length} puntuats
            </Badge>
          </span>
          {editable ? (
            <Select
              value={order}
              onChange={(e) => handleOrderChange(e.target.value as ScoreOrder)}
              className="h-8 w-auto py-0 text-xs"
              aria-label="Ordre de classificació"
            >
              <option value="desc">{scoreOrderLabels.desc}</option>
              <option value="asc">{scoreOrderLabels.asc}</option>
            </Select>
          ) : (
            <span className="text-xs font-normal subtle">
              {scoreOrderLabels[order]}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/80 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="w-12 px-3 py-2 text-center">Pos.</th>
                <th className="px-3 py-2">{individual ? "Participant" : "Equip"}</th>
                <th className="px-3 py-2 text-center">Puntuació</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
              {displayRows.map((row) => {
                const team = teamById.get(row.teamId);
                if (!team) return null;
                return (
                  <tr key={row.teamId} className="text-slate-700 dark:text-slate-300">
                    <td className="px-3 py-1.5 text-center font-bold text-brand-700 dark:text-brand-300">
                      {row.position ?? "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="font-medium text-slate-900 dark:text-white">
                        {team.name}
                      </span>
                      {individual ? null : (
                        <span className="block text-xs subtle">
                          {team.participantIds
                            .map((pid) => participantById.get(pid)?.name)
                            .filter(Boolean)
                            .join(", ") || "Sense membres"}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-center">
                      <ScoreInput
                        key={`${row.teamId}-${row.score ?? "x"}`}
                        stored={row.score}
                        editable={editable}
                        label={`Puntuació de ${team.name}`}
                        onCommit={(v) => handleScore(row.teamId, v)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editable ? (
        <section className="card flex flex-wrap items-center gap-3 card-pad">
          <Button
            variant="primary"
            onClick={handleFinalize}
            disabled={busy || !canFinalize}
            size="lg"
          >
            {busy ? "Finalitzant…" : "🏆 Finalitzar i calcular punts"}
          </Button>
          {!canFinalize ? (
            <p className="text-sm muted">
              Introdueix la puntuació d'almenys 2{" "}
              {individual ? "participants" : "equips"} per poder finalitzar.
            </p>
          ) : missing.length > 0 ? (
            <p className="text-sm muted">
              Falten {missing.length} per puntuar.
            </p>
          ) : null}
        </section>
      ) : null}

      {event.status === "finished" ? (
        <FinalSummary
          data={data}
          onReopen={readOnly ? undefined : handleReopen}
          teamSuffix={(tid) =>
            scores[tid] != null ? `${scores[tid]} pts` : null
          }
        />
      ) : null}
    </div>
  );
}
