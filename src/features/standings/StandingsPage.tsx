import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/ui/PageHeader";
import { Badge, ErrorMessage } from "@/ui/forms";
import { eventsRepo, participantsRepo } from "@/data";
import type { OlimpiadaEvent, Participant } from "@/domain/types";
import { useSeasons } from "@/features/seasons/useSeasons";

interface Row {
  participantId: string;
  participantName: string;
  total: number;
  positionPoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  events: number;
}

export function StandingsPage() {
  const { currentSeason, loading: seasonLoading } = useSeasons();
  const [events, setEvents] = useState<OlimpiadaEvent[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!currentSeason) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [evs, ps] = await Promise.all([
          eventsRepo.list(currentSeason.id),
          participantsRepo.list(currentSeason.id),
        ]);
        setEvents(evs);
        setParticipants(ps);
      } catch (e) {
        console.error(e);
        setError("No s'ha pogut carregar la classificació.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [currentSeason]);

  const rows = useMemo<Row[]>(() => {
    const byParticipant = new Map<string, Row>();
    for (const p of participants) {
      byParticipant.set(p.id, {
        participantId: p.id,
        participantName: p.name,
        total: 0,
        positionPoints: 0,
        bonusPoints: 0,
        penaltyPoints: 0,
        events: 0,
      });
    }
    for (const ev of events) {
      if (ev.status !== "finished" || !ev.pointsBreakdown) continue;
      for (const b of ev.pointsBreakdown) {
        const existing = byParticipant.get(b.participantId);
        if (!existing) continue;
        existing.total += b.total;
        existing.positionPoints += b.positionPoints;
        existing.bonusPoints += b.bonusPoints;
        existing.penaltyPoints += b.penaltyPoints;
        existing.events += 1;
      }
    }
    return [...byParticipant.values()].sort(
      (a, b) => b.total - a.total || a.participantName.localeCompare(b.participantName)
    );
  }, [events, participants]);

  const finishedEvents = events.filter((e) => e.status === "finished").length;
  const topThree = rows.slice(0, 3).filter(() => finishedEvents > 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={currentSeason ? currentSeason.name : undefined}
        title="Classificació general"
        description={
          currentSeason
            ? `${finishedEvents} esdeveniment${finishedEvents === 1 ? "" : "s"} finalitzat${finishedEvents === 1 ? "" : "s"} · ${participants.length} participants`
            : "Rànquing acumulat de la temporada."
        }
      />

      {!currentSeason && !seasonLoading ? (
        <EmptyState>Encara no hi ha cap temporada activa.</EmptyState>
      ) : loading || seasonLoading ? (
        <EmptyState>Carregant…</EmptyState>
      ) : error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : rows.length === 0 ? (
        <EmptyState>Encara no hi ha participants en aquesta temporada.</EmptyState>
      ) : finishedEvents === 0 ? (
        <EmptyState>
          Encara no s'ha finalitzat cap esdeveniment aquesta temporada.
        </EmptyState>
      ) : (
        <>
          {topThree.length > 0 ? <Podium rows={topThree} /> : null}
          <StandingsTable rows={rows} />
        </>
      )}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="card card-pad text-center text-sm muted">{children}</div>
  );
}

const MEDAL_GRADIENTS = [
  "from-amber-300 to-amber-500 dark:from-amber-400 dark:to-amber-600",
  "from-slate-300 to-slate-400 dark:from-slate-400 dark:to-slate-500",
  "from-orange-300 to-orange-500 dark:from-orange-400 dark:to-orange-600",
];

const MEDAL_EMOJIS = ["🥇", "🥈", "🥉"];

function Podium({ rows }: { rows: Row[] }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest muted">
        Podi
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {rows.map((r, idx) => (
          <div
            key={r.participantId}
            className="card relative overflow-hidden card-pad transition-transform hover:-translate-y-0.5"
          >
            <div
              aria-hidden
              className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${MEDAL_GRADIENTS[idx]}`}
            />
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center text-2xl"
                aria-hidden
              >
                {MEDAL_EMOJIS[idx]}
              </span>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-widest subtle">
                  {idx + 1}
                  {idx === 0 ? "r" : idx === 1 ? "n" : "r"} lloc
                </p>
                <p
                  className="truncate text-lg font-semibold text-slate-900 dark:text-white"
                  title={r.participantName}
                >
                  {r.participantName}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-bold text-brand-600 dark:text-brand-400">
                {r.total}
              </span>
              <span className="text-xs muted">punts · {r.events} esdev.</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StandingsTable({ rows }: { rows: Row[] }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest muted">
        Rànquing complet
      </h2>

      {/* Mobile: cards */}
      <ul className="space-y-2 sm:hidden">
        {rows.map((r, idx) => (
          <li
            key={r.participantId}
            className={`card flex items-center justify-between gap-3 px-4 py-3 ${idx < 3 ? "ring-1 ring-brand-500/20 dark:ring-brand-400/20" : ""}`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <RankBadge rank={idx + 1} />
              <div className="min-w-0">
                <p
                  className="truncate font-semibold text-slate-900 dark:text-white"
                  title={r.participantName}
                >
                  {r.participantName}
                </p>
                <p className="text-xs subtle">
                  {r.events} esdev. · pos {r.positionPoints} · bonus {r.bonusPoints}
                  {r.penaltyPoints ? ` · pen ${r.penaltyPoints}` : ""}
                </p>
              </div>
            </div>
            <span className="text-right text-xl font-bold text-brand-600 dark:text-brand-400">
              {r.total}
            </span>
          </li>
        ))}
      </ul>

      {/* Desktop: taula */}
      <div className="card hidden overflow-x-auto sm:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Participant</th>
              <th className="px-4 py-3 text-right">Esdev.</th>
              <th className="px-4 py-3 text-right">Punts guanyats</th>
              <th className="px-4 py-3 text-right">Bonus</th>
              <th className="px-4 py-3 text-right">Pen.</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
            {rows.map((r, idx) => (
              <tr
                key={r.participantId}
                className={`transition-colors hover:bg-brand-50/50 dark:hover:bg-slate-800/40 ${idx < 3 ? "bg-brand-50/30 dark:bg-brand-500/5" : ""}`}
              >
                <td className="px-4 py-3">
                  <RankBadge rank={idx + 1} />
                </td>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                  {r.participantName}
                </td>
                <td className="px-4 py-3 text-right muted">{r.events}</td>
                <td className="px-4 py-3 text-right muted">{r.positionPoints}</td>
                <td className="px-4 py-3 text-right muted">{r.bonusPoints}</td>
                <td className="px-4 py-3 text-right muted">{r.penaltyPoints}</td>
                <td className="px-4 py-3 text-right text-base font-bold text-brand-700 dark:text-brand-300">
                  {r.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const emoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center text-lg"
        aria-label={`Posició ${rank}`}
      >
        {emoji}
      </span>
    );
  }
  return <Badge tone="slate">{rank}</Badge>;
}
