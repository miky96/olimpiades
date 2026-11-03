import { Badge, Button } from "@/ui/forms";
import type { EventData } from "../EventDetailPage";

/**
 * Resum d'un esdeveniment finalitzat per als formats que desen
 * `finalStandings` per equip (partits, bracket, lligueta, prova única).
 */
export function FinalSummary({
  data,
  onReopen,
  teamSuffix,
}: {
  data: EventData;
  onReopen?: () => void;
  /** Text opcional al costat del nom de cada equip (p. ex. la puntuació). */
  teamSuffix?: (teamId: string) => string | null;
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
                      .map((tid) => {
                        const name = teamById.get(tid)?.name ?? "—";
                        const suffix = teamSuffix?.(tid);
                        return suffix ? `${name} (${suffix})` : name;
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
                  <th className="py-2 text-center">Punts guanyats</th>
                  <th className="py-2 text-center">Bonus assist.</th>
                  <th className="py-2 text-center">Pen.</th>
                  <th className="py-2 text-center">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-200/50 dark:divide-emerald-500/20">
                {event.pointsBreakdown
                  .filter((b) => participantById.has(b.participantId))
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
