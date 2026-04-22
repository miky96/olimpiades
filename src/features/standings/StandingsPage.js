import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/ui/PageHeader";
import { ErrorMessage } from "@/ui/forms";
import { eventsRepo, participantsRepo } from "@/data";
import { useSeasons } from "@/features/seasons/SeasonContext";
export function StandingsPage() {
    const { currentSeason, loading: seasonLoading } = useSeasons();
    const [events, setEvents] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
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
            }
            catch (e) {
                console.error(e);
                setError("No s'ha pogut carregar la classificació.");
            }
            finally {
                setLoading(false);
            }
        }
        void load();
    }, [currentSeason]);
    const rows = useMemo(() => {
        const byParticipant = new Map();
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
            if (ev.status !== "finished" || !ev.pointsBreakdown)
                continue;
            for (const b of ev.pointsBreakdown) {
                const existing = byParticipant.get(b.participantId);
                if (!existing)
                    continue;
                existing.total += b.total;
                existing.positionPoints += b.positionPoints;
                existing.bonusPoints += b.bonusPoints;
                existing.penaltyPoints += b.penaltyPoints;
                existing.events += 1;
            }
        }
        return [...byParticipant.values()].sort((a, b) => b.total - a.total || a.participantName.localeCompare(b.participantName));
    }, [events, participants]);
    const finishedEvents = events.filter((e) => e.status === "finished").length;
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(PageHeader, { title: "Classificaci\u00F3 general", description: currentSeason
                    ? `Temporada: ${currentSeason.name} · ${finishedEvents} esdeveniment${finishedEvents === 1 ? "" : "s"} finalitzat${finishedEvents === 1 ? "" : "s"}`
                    : "Rànquing acumulat de la temporada." }), !currentSeason && !seasonLoading ? (_jsx("div", { className: "rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500", children: "Encara no hi ha cap temporada activa." })) : loading || seasonLoading ? (_jsx("p", { className: "rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500", children: "Carregant\u2026" })) : error ? (_jsx(ErrorMessage, { children: error })) : rows.length === 0 ? (_jsx("div", { className: "rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500", children: "Encara no hi ha participants en aquesta temporada." })) : finishedEvents === 0 ? (_jsx("div", { className: "rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500", children: "Encara no s'ha finalitzat cap esdeveniment aquesta temporada." })) : (_jsx("div", { className: "overflow-x-auto rounded-lg border border-slate-200 bg-white", children: _jsxs("table", { className: "min-w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 text-left text-xs font-medium text-slate-600", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-2", children: "#" }), _jsx("th", { className: "px-4 py-2", children: "Participant" }), _jsx("th", { className: "px-4 py-2 text-right", children: "Esdeveniments" }), _jsx("th", { className: "px-4 py-2 text-right", children: "Posici\u00F3" }), _jsx("th", { className: "px-4 py-2 text-right", children: "Bonus" }), _jsx("th", { className: "px-4 py-2 text-right", children: "Penal." }), _jsx("th", { className: "px-4 py-2 text-right", children: "Total" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: rows.map((r, idx) => (_jsxs("tr", { className: "text-slate-700", children: [_jsx("td", { className: "px-4 py-2 text-slate-500", children: idx + 1 }), _jsx("td", { className: "px-4 py-2 font-medium text-slate-900", children: r.participantName }), _jsx("td", { className: "px-4 py-2 text-right", children: r.events }), _jsx("td", { className: "px-4 py-2 text-right", children: r.positionPoints }), _jsx("td", { className: "px-4 py-2 text-right", children: r.bonusPoints }), _jsx("td", { className: "px-4 py-2 text-right", children: r.penaltyPoints }), _jsx("td", { className: "px-4 py-2 text-right font-semibold", children: r.total })] }, r.participantId))) })] }) }))] }));
}
