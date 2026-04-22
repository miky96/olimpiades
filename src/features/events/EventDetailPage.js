import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/ui/PageHeader";
import { ErrorMessage } from "@/ui/forms";
import { attendanceRepo, eventsRepo, matchesRepo, participantsRepo, teamsRepo, } from "@/data";
import { formatLabels } from "@/domain/formatLabels";
import { useSeasons } from "@/features/seasons/SeasonContext";
import { useAuth, hasRole } from "@/features/auth/AuthContext";
import { TeamsTab } from "./tabs/TeamsTab";
import { AttendanceTab } from "./tabs/AttendanceTab";
import { ResultsTab } from "./tabs/ResultsTab";
export function EventDetailPage() {
    const { eventId } = useParams();
    const { currentSeason } = useSeasons();
    const { appUser } = useAuth();
    const canWrite = hasRole(appUser, ["admin", "superadmin"]);
    const isArchived = currentSeason?.status === "archived";
    const readOnly = !canWrite || isArchived;
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState("teams");
    const seasonId = currentSeason?.id;
    const load = useCallback(async () => {
        if (!seasonId || !eventId)
            return;
        setLoading(true);
        setError(null);
        try {
            const [event, teams, participants, matches, attendance] = await Promise.all([
                eventsRepo.get(seasonId, eventId),
                teamsRepo.list(seasonId, eventId),
                participantsRepo.list(seasonId),
                matchesRepo.list(seasonId, eventId),
                attendanceRepo.listForEvent(seasonId, eventId),
            ]);
            if (!event) {
                setError("Aquest esdeveniment no existeix.");
                setData(null);
                return;
            }
            setData({ event, teams, participants, matches, attendance });
        }
        catch (e) {
            console.error(e);
            setError("No s'han pogut carregar les dades de l'esdeveniment.");
        }
        finally {
            setLoading(false);
        }
    }, [seasonId, eventId]);
    useEffect(() => {
        void load();
    }, [load]);
    if (!currentSeason) {
        return (_jsxs("div", { children: [_jsx(PageHeader, { title: "Esdeveniment" }), _jsx("div", { className: "rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600", children: "Cap temporada seleccionada." })] }));
    }
    if (loading) {
        return (_jsxs("div", { children: [_jsx(PageHeader, { title: "Esdeveniment" }), _jsx("p", { className: "rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500", children: "Carregant\u2026" })] }));
    }
    if (error || !data) {
        return (_jsxs("div", { className: "space-y-4", children: [_jsx(PageHeader, { title: "Esdeveniment" }), _jsx(ErrorMessage, { children: error ?? "Esdeveniment no trobat." }), _jsx(Link, { to: "/esdeveniments", className: "text-sm text-slate-700 underline", children: "\u2190 Tornar a la llista" })] }));
    }
    const { event } = data;
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx(Link, { to: "/esdeveniments", className: "mb-2 inline-block text-xs text-slate-500 hover:text-slate-700", children: "\u2190 Esdeveniments" }), _jsx(PageHeader, { title: event.name ? `${event.name} · ${event.sport}` : event.sport, description: `${event.date} · ${formatLabels[event.format]} · ${statusLabel(event.status)}` })] }), _jsxs("div", { className: "flex gap-1 border-b border-slate-200", children: [_jsx(TabButton, { active: tab === "teams", onClick: () => setTab("teams"), children: "Equips" }), _jsx(TabButton, { active: tab === "attendance", onClick: () => setTab("attendance"), children: "Assist\u00E8ncia" }), _jsx(TabButton, { active: tab === "results", onClick: () => setTab("results"), children: "Resultats" })] }), tab === "teams" ? (_jsx(TeamsTab, { data: data, readOnly: readOnly, onChanged: load })) : tab === "attendance" ? (_jsx(AttendanceTab, { data: data, readOnly: readOnly, onChanged: load })) : (_jsx(ResultsTab, { data: data, readOnly: readOnly, onChanged: load })), canWrite && !isArchived && event.status !== "draft" ? (_jsxs("section", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600", children: ["L'esdeveniment est\u00E0 ", event.status === "in_progress" ? "en curs" : "finalitzat", ".", event.status === "finished" ? (_jsxs(_Fragment, { children: [" ", "Per editar-lo de nou, haur\u00E0s de reobrir-lo des de la tab", _jsx("em", { children: " Resultats" }), "."] })) : null] })) : null] }));
}
function statusLabel(s) {
    switch (s) {
        case "draft":
            return "Esborrany";
        case "in_progress":
            return "En curs";
        case "finished":
            return "Finalitzat";
    }
}
function TabButton({ active, onClick, children, }) {
    return (_jsx("button", { type: "button", onClick: onClick, className: `-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${active
            ? "border-slate-900 text-slate-900"
            : "border-transparent text-slate-500 hover:text-slate-700"}`, children: children }));
}
