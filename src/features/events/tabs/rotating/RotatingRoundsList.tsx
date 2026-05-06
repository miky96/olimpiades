import type { Match, Team } from "@/domain/types";
import { Button } from "@/ui/forms";
import { listRotatingMatches } from "@/domain";

interface Props {
  matches: Match[];
  teamById: Map<string, Team>;
  editable: boolean;
  busyMatchId: string | null;
  onSetWinner: (match: Match, winnerTeamId: string | null) => void;
}

export function RotatingRoundsList({
  matches,
  teamById,
  editable,
  busyMatchId,
  onSetWinner,
}: Props) {
  const list = listRotatingMatches(matches);
  if (list.length === 0) return null;

  return (
    <ul className="card-divide">
      {list.map((m) => {
        const teamA = m.teamAId ? teamById.get(m.teamAId) : null;
        const teamB = m.teamBId ? teamById.get(m.teamBId) : null;
        const busy = busyMatchId === m.id;
        const winnerA = m.winnerTeamId === m.teamAId;
        const winnerB = m.winnerTeamId === m.teamBId;

        return (
          <li key={m.id} className="px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Ronda {m.round ?? "?"}
                </p>
                <RotatingTeamLine
                  team={teamA ?? null}
                  isWinner={winnerA}
                  fallback="—"
                />
                <RotatingTeamLine
                  team={teamB ?? null}
                  isWinner={winnerB}
                  fallback="—"
                />
              </div>
              {editable ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={winnerA ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => onSetWinner(m, m.teamAId)}
                    disabled={busy || !m.teamAId}
                  >
                    Guanya {teamA?.name ?? "A"}
                  </Button>
                  <Button
                    variant={winnerB ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => onSetWinner(m, m.teamBId)}
                    disabled={busy || !m.teamBId}
                  >
                    Guanya {teamB?.name ?? "B"}
                  </Button>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RotatingTeamLine({
  team,
  isWinner,
  fallback,
}: {
  team: Team | null;
  isWinner: boolean;
  fallback: string;
}) {
  return (
    <p
      className={`mt-0.5 text-sm ${
        isWinner
          ? "font-semibold text-emerald-700 dark:text-emerald-400"
          : "text-slate-700 dark:text-slate-300"
      }`}
    >
      <span className="font-medium">{team?.name ?? fallback}</span>
      {team && team.participantIds.length > 0 ? (
        <span className="ml-1 text-xs subtle">
          ({team.participantIds.length} jug.)
        </span>
      ) : null}
    </p>
  );
}
