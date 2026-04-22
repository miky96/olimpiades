import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/ui/PageHeader";
import { Button, ErrorMessage, Field, Input } from "@/ui/forms";
import { eventsRepo } from "@/data";
import { formatLabels } from "@/domain/formatLabels";
import { useSeasons } from "@/features/seasons/SeasonContext";
import { useAuth, hasRole } from "@/features/auth/AuthContext";
const FORMATS = ["single_match", "bracket", "group_stage_bracket"];
export function EventsPage() {
    const { currentSeason } = useSeasons();
    const { appUser } = useAuth();
    const canWrite = hasRole(appUser, ["admin", "superadmin"]);
    const isArchived = currentSeason?.status === "archived";
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [name, setName] = useState("");
    const [sport, setSport] = useState("");
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [format, setFormat] = useState("bracket");
    const [groupSize, setGroupSize] = useState(4);
    const [creating, setCreating] = useState(false);
    const [formError, setFormError] = useState(null);
    const load = useCallback(async () => {
        if (!currentSeason)
            return;
        setLoading(true);
        setError(null);
        try {
            const list = await eventsRepo.list(currentSeason.id);
            setEvents(list);
        }
        catch (e) {
            console.error(e);
            setError("No s'han pogut carregar els esdeveniments.");
        }
        finally {
            setLoading(false);
        }
    }, [currentSeason]);
    useEffect(() => {
        void load();
    }, [load]);
    if (!currentSeason) {
        return (_jsxs("div", { children: [_jsx(PageHeader, { title: "Esdeveniments" }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600", children: ["Cap temporada seleccionada. Crea'n una a ", _jsx("em", { children: "Temporades" }), "."] })] }));
    }
    async function handleCreate(e) {
        e.preventDefault();
        if (!canWrite || !currentSeason)
            return;
        setFormError(null);
        const trimmedSport = sport.trim();
        if (!trimmedSport) {
            setFormError("Indica l'esport.");
            return;
        }
        setCreating(true);
        try {
            const payload = {
                sport: trimmedSport,
                date,
                format,
                status: "draft",
                config: format === "group_stage_bracket"
                    ? { groupSize, qualifiersPerGroup: 2 }
                    : {},
            };
            const trimmedName = name.trim();
            if (trimmedName)
                payload.name = trimmedName;
            await eventsRepo.create(currentSeason.id, payload);
            setName("");
            setSport("");
            await load();
        }
        catch (err) {
            console.error(err);
            setFormError("No s'ha pogut crear l'esdeveniment.");
        }
        finally {
            setCreating(false);
        }
    }
    async function handleRemove(ev) {
        if (!canWrite || !currentSeason)
            return;
        if (ev.status !== "draft") {
            window.alert("Només es poden eliminar esdeveniments en esborrany. Els que ja han començat s'han de finalitzar.");
            return;
        }
        const ok = window.confirm(`Eliminar l'esdeveniment "${ev.name || ev.sport}"? Aquesta acció és irreversible.`);
        if (!ok)
            return;
        try {
            await eventsRepo.remove(currentSeason.id, ev.id);
            await load();
        }
        catch (err) {
            console.error(err);
            window.alert("No s'ha pogut eliminar l'esdeveniment.");
        }
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(PageHeader, { title: "Esdeveniments", description: `Temporada: ${currentSeason.name}${isArchived ? " (arxivada, només lectura)" : ""}` }), canWrite && !isArchived ? (_jsxs("section", { className: "rounded-lg border border-slate-200 bg-white p-6", children: [_jsx("h2", { className: "mb-3 text-sm font-semibold text-slate-900", children: "Nou esdeveniment" }), _jsxs("form", { onSubmit: handleCreate, className: "grid gap-3 md:grid-cols-2", children: [_jsx(Field, { label: "Esport", children: _jsx(Input, { type: "text", required: true, value: sport, onChange: (e) => setSport(e.target.value), placeholder: "Ex. Ping-pong" }) }), _jsx(Field, { label: "Nom (opcional)", children: _jsx(Input, { type: "text", value: name, onChange: (e) => setName(e.target.value), placeholder: "Ex. Torneig de primavera" }) }), _jsx(Field, { label: "Data", children: _jsx(Input, { type: "date", required: true, value: date, onChange: (e) => setDate(e.target.value) }) }), _jsx(Field, { label: "Format", children: _jsx("select", { className: "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500", value: format, onChange: (e) => setFormat(e.target.value), children: FORMATS.map((f) => (_jsx("option", { value: f, children: formatLabels[f] }, f))) }) }), format === "group_stage_bracket" ? (_jsx(Field, { label: "Mida de grup", children: _jsxs("select", { className: "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500", value: groupSize, onChange: (e) => setGroupSize(Number(e.target.value)), children: [_jsx("option", { value: 3, children: "3 equips per grup" }), _jsx("option", { value: 4, children: "4 equips per grup" })] }) })) : null, _jsxs("div", { className: "md:col-span-2 flex items-center justify-end gap-3", children: [formError ? _jsx(ErrorMessage, { children: formError }) : null, _jsx(Button, { type: "submit", disabled: creating, children: creating ? "Creant…" : "Crear" })] })] })] })) : null, _jsxs("section", { className: "rounded-lg border border-slate-200 bg-white", children: [_jsxs("h2", { className: "border-b border-slate-100 px-6 py-3 text-sm font-semibold text-slate-900", children: ["Llista (", events.length, ")"] }), loading ? (_jsx("p", { className: "p-6 text-sm text-slate-500", children: "Carregant\u2026" })) : error ? (_jsx("div", { className: "p-6", children: _jsx(ErrorMessage, { children: error }) })) : events.length === 0 ? (_jsx("p", { className: "p-6 text-sm text-slate-500", children: "Encara no hi ha esdeveniments." })) : (_jsx("ul", { className: "divide-y divide-slate-100", children: events.map((ev) => (_jsxs("li", { className: "flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm", children: [_jsxs("div", { children: [_jsxs("p", { className: "font-medium text-slate-900", children: [ev.name ? `${ev.name} · ` : "", ev.sport] }), _jsxs("p", { className: "text-xs text-slate-500", children: [ev.date, " \u00B7 ", formatLabels[ev.format]] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(StatusBadge, { status: ev.status }), _jsx(Link, { to: `/esdeveniments/${ev.id}`, className: "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50", children: "Obrir" }), canWrite && !isArchived && ev.status === "draft" ? (_jsx(Button, { variant: "danger", onClick: () => handleRemove(ev), children: "Eliminar" })) : null] })] }, ev.id))) }))] })] }));
}
function StatusBadge({ status }) {
    const styles = {
        draft: "bg-slate-100 text-slate-700",
        in_progress: "bg-amber-100 text-amber-800",
        finished: "bg-emerald-100 text-emerald-800",
    };
    const labels = {
        draft: "Esborrany",
        in_progress: "En curs",
        finished: "Finalitzat",
    };
    return (_jsx("span", { className: `rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`, children: labels[status] }));
}
