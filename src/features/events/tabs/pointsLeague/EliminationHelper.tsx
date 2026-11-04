import { useMemo, useState } from "react";
import { Badge, Button, ErrorMessage, Select } from "@/ui/forms";
import { pointsRoundsRepo } from "@/data";
import type { PointsRound, Team } from "@/domain/types";
import {
  getEliminationState,
  planDeclareWinner,
  planElimination,
  planUndo,
  positionForElimination,
} from "@/domain/competition/eliminationRound";
import { ordinalCa } from "./placementLabels";

interface Props {
  seasonId: string;
  eventId: string;
  teams: Team[];
  rounds: PointsRound[];
  onChanged: () => Promise<void> | void;
}

/**
 * Ajuda per a jocs eliminatoris en mode "per posicions": l'admin marca qui
 * queda eliminat i l'app assigna les posicions (primer eliminat = últim).
 * L'estat es deriva de la ronda; només "qui no juga" és estat local.
 */
export function EliminationHelper({
  seasonId,
  eventId,
  teams,
  rounds,
  onChanged,
}: Props) {
  const sortedRounds = useMemo(
    () => [...rounds].sort((a, b) => a.roundNumber - b.roundNumber),
    [rounds]
  );
  const [chosenRoundId, setChosenRoundId] = useState<string | null>(null);
  const round =
    sortedRounds.find((r) => r.id === chosenRoundId) ??
    sortedRounds[sortedRounds.length - 1];

  const [absentByRound, setAbsentByRound] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamName = useMemo(() => {
    const byId = new Map(teams.map((t) => [t.id, t.name]));
    return (id: string) => byId.get(id) ?? id;
  }, [teams]);

  if (!round) return null;

  const absent = absentByRound[round.id] ?? [];
  const playing = teams.map((t) => t.id).filter((id) => !absent.includes(id));
  const state = getEliminationState(round, playing);
  const selectedAlive = selected.filter((id) => state.alive.includes(id));
  const finished = state.alive.length === 0 && state.eliminated.length > 0;

  function changeRound(id: string) {
    setChosenRoundId(id);
    setSelected([]);
    setError(null);
  }

  function toggleSelected(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function setAbsent(id: string, isAbsent: boolean) {
    setSelected((prev) => prev.filter((x) => x !== id));
    setAbsentByRound((prev) => {
      const current = prev[round.id] ?? [];
      const next = isAbsent
        ? [...current, id]
        : current.filter((x) => x !== id);
      return { ...prev, [round.id]: next };
    });
  }

  async function run(op: () => Promise<void>, failMsg: string) {
    setBusy(true);
    setError(null);
    try {
      await op();
      setSelected([]);
      await onChanged();
    } catch (err) {
      console.error(err);
      setError(failMsg);
    } finally {
      setBusy(false);
    }
  }

  function handleEliminate() {
    const writes = planElimination(state, selectedAlive);
    void run(
      () => pointsRoundsRepo.setScores(seasonId, eventId, round.id, writes),
      "No s'ha pogut desar l'eliminació."
    );
  }

  function handleDeclareWinner() {
    const writes = planDeclareWinner(state);
    void run(
      () => pointsRoundsRepo.setScores(seasonId, eventId, round.id, writes),
      "No s'ha pogut desar el guanyador."
    );
  }

  function handleUndo() {
    const ids = planUndo(state);
    void run(
      () => pointsRoundsRepo.clearScores(seasonId, eventId, round.id, ids),
      "No s'ha pogut desfer."
    );
  }

  const nextPosition =
    selectedAlive.length > 0
      ? positionForElimination(state, selectedAlive.length)
      : null;

  // Agrupem eliminats per posició (millor a dalt).
  const groups: { position: number; names: string[] }[] = [];
  for (const e of state.eliminated) {
    const last = groups[groups.length - 1];
    if (last && last.position === e.position) last.names.push(teamName(e.teamId));
    else groups.push({ position: e.position, names: [teamName(e.teamId)] });
  }

  return (
    <section className="card">
      <div className="card-header flex-wrap gap-2">
        <span>
          Ajuda d'eliminació{" "}
          {finished ? <Badge tone="emerald">Ronda completa</Badge> : null}
        </span>
        <Select
          value={round.id}
          onChange={(e) => changeRound(e.target.value)}
          className="h-8 w-auto py-0 text-xs"
          aria-label="Ronda"
        >
          {sortedRounds.map((r) => (
            <option key={r.id} value={r.id}>
              Ronda {r.roundNumber}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-4 card-pad">
        <p className="text-xs subtle">
          Toca qui queda eliminat i prem <em>Eliminar</em>: el primer eliminat
          queda últim. Si en cauen diversos alhora, selecciona'ls tots i
          compartiran posició. L'últim que queda és el guanyador.
        </p>

        {error ? <ErrorMessage>{error}</ErrorMessage> : null}

        {state.alive.length > 0 ? (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest muted">
              En joc ({state.alive.length})
            </h3>
            <ul className="flex flex-wrap gap-2">
              {state.alive.map((id) => {
                const isSelected = selectedAlive.includes(id);
                return (
                  <li key={id} className="flex items-center">
                    <Button
                      variant={isSelected ? "danger" : "secondary"}
                      size="sm"
                      className="rounded-r-none"
                      onClick={() => toggleSelected(id)}
                      disabled={busy}
                      aria-pressed={isSelected}
                    >
                      {teamName(id)}
                    </Button>
                    {state.eliminated.length === 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-l-none"
                        onClick={() => setAbsent(id, true)}
                        disabled={busy}
                        title="No juga aquesta ronda"
                      >
                        No juga
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {absent.length > 0 ? (
          <p className="text-xs subtle">
            No juguen:{" "}
            {absent.map((id, idx) => (
              <span key={id}>
                {idx > 0 ? ", " : ""}
                <button
                  type="button"
                  className="underline hover:no-underline"
                  onClick={() => setAbsent(id, false)}
                  disabled={busy}
                  title="Tornar a posar en joc"
                >
                  {teamName(id)}
                </button>
              </span>
            ))}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {state.alive.length > 1 || selectedAlive.length > 0 ? (
            <Button
              variant="danger"
              onClick={handleEliminate}
              disabled={busy || selectedAlive.length === 0}
            >
              {nextPosition != null
                ? `Eliminar (${selectedAlive.length}) → ${ordinalCa(nextPosition)}`
                : "Eliminar"}
            </Button>
          ) : null}
          {state.alive.length === 1 ? (
            <Button onClick={handleDeclareWinner} disabled={busy}>
              🏆 Guanya {teamName(state.alive[0])}
            </Button>
          ) : null}
          {state.eliminated.length > 0 ? (
            <Button variant="secondary" onClick={handleUndo} disabled={busy}>
              Desfer l'últim
            </Button>
          ) : null}
        </div>

        {groups.length > 0 ? (
          <ol className="space-y-1 text-sm">
            {groups.map((g) => (
              <li key={g.position} className="flex items-center gap-2">
                <Badge tone={g.position === 1 ? "amber" : "slate"}>
                  {ordinalCa(g.position)}
                </Badge>
                <span className="text-slate-800 dark:text-slate-200">
                  {g.names.join(", ")}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
