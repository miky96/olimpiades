import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/ui/PageHeader";
import { ErrorMessage } from "@/ui/forms";
import { eventsRepo, participantsRepo } from "@/data";
import type { OlimpiadaEvent, Participant } from "@/domain/types";
import { useSeasons } from "@/features/seasons/SeasonContext";

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classificació general"
        description={
          currentSeason
            ? `Temporada: ${currentSeason.name} · ${finishedEvents} esdeveniment${finishedEvents === 1 ? "" : "s"} finalitzat${finishedEvents === 1 ? "" : "s"}`
            : "Rànquing acumulat de la temporada."
        }
      />

      {!currentSeason && !seasonLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Encara no hi ha cap temporada activa.
        </div>
      ) : loading || seasonLoading ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Carregant…
        </p>
      ) : error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Encara no hi ha participants en aquesta temporada.
        </div>
      ) : finishedEvents === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Encara no s'ha finalitzat cap esdeveniment aquesta temporada.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-600">
              <tr>
                <th className="px-4 py-2">Posició</th>
                <th className="px-4 py-2">Participant</th>
                <th className="px-4 py-2 text-right">Esdeveniments</th>
                <th className="px-4 py-2 text-right">Puntuació esdeveniments</th>
                <th className="px-4 py-2 text-right">Bonus assistència</th>
                <th className="px-4 py-2 text-right">Penalitzacions</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, idx) => (
                <tr key={r.participantId} className="text-slate-700">
                  <td className="px-4 py-2 text-slate-500">{idx + 1}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {r.participantName}
                  </td>
                  <td className="px-4 py-2 text-right">{r.events}</td>
                  <td className="px-4 py-2 text-right">{r.positionPoints}</td>
                  <td className="px-4 py-2 text-right">{r.bonusPoints}</td>
                  <td className="px-4 py-2 text-right">{r.penaltyPoints}</td>
                  <td className="px-4 py-2 text-right font-semibold">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
