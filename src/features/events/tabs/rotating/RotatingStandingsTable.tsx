import { useMemo } from "react";
import type { Match, Participant, Team } from "@/domain/types";
import {
  computeRotatingIndividualStandings,
  computeRotatingStats,
} from "@/domain";

interface Props {
  matches: Match[];
  teams: Team[];
  participants: Participant[];
}

export function RotatingStandingsTable({ matches, teams, participants }: Props) {
  const participantById = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants]
  );

  const stats = useMemo(
    () => computeRotatingStats(matches, teams),
    [matches, teams]
  );
  const standings = useMemo(
    () => computeRotatingIndividualStandings(matches, teams),
    [matches, teams]
  );

  const positionByParticipant = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of standings) {
      for (const pid of s.participantIds) map.set(pid, s.position);
    }
    return map;
  }, [standings]);

  const sorted = useMemo(
    () =>
      stats
        .slice()
        .sort(
          (a, b) =>
            b.matchPoints - a.matchPoints ||
            b.won - a.won ||
            a.played - b.played
        ),
    [stats]
  );

  if (sorted.length === 0) {
    return (
      <p className="text-sm muted">
        Encara no hi ha resultats registrats. La classificació es mostrarà aquí.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800/70">
      <table className="w-full text-xs">
        <thead className="bg-slate-50/80 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
          <tr>
            <th className="w-10 px-2 py-2 text-center">Pos</th>
            <th className="px-2 py-2">Participant</th>
            <th className="px-2 py-2 text-center">PJ</th>
            <th className="px-2 py-2 text-center">G</th>
            <th className="px-2 py-2 text-center">P</th>
            <th className="px-2 py-2 text-center">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
          {sorted.map((s) => {
            const position = positionByParticipant.get(s.participantId);
            return (
              <tr
                key={s.participantId}
                className="text-slate-700 dark:text-slate-300"
              >
                <td className="px-2 py-1.5 text-center font-bold">
                  {position ?? "—"}
                </td>
                <td className="px-2 py-1.5 font-medium">
                  {participantById.get(s.participantId)?.name ?? s.participantId}
                </td>
                <td className="px-2 py-1.5 text-center">{s.played}</td>
                <td className="px-2 py-1.5 text-center">{s.won}</td>
                <td className="px-2 py-1.5 text-center">{s.lost}</td>
                <td className="px-2 py-1.5 text-center font-bold text-brand-700 dark:text-brand-300">
                  {s.matchPoints}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
