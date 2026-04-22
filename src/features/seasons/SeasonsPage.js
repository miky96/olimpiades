import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { PageHeader } from "@/ui/PageHeader";
import { Button, ErrorMessage, Field, Input } from "@/ui/forms";
import { seasonsRepo } from "@/data";
import { useSeasons } from "./SeasonContext";
export function SeasonsPage() {
    const { seasons, currentSeason, loading, error, refresh, selectSeason } = useSeasons();
    const [name, setName] = useState("");
    const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [creating, setCreating] = useState(false);
    const [formError, setFormError] = useState(null);
    const hasActive = seasons.some((s) => s.status === "active");
    async function handleCreate(e) {
        e.preventDefault();
        setFormError(null);
        if (hasActive) {
            setFormError("Ja hi ha una temporada activa. Arxiva-la abans de crear-ne una de nova.");
            return;
        }
        setCreating(true);
        try {
            await seasonsRepo.create({
                name: name.trim(),
                startDate,
                status: "active",
            });
            setName("");
            await refresh();
        }
        catch (err) {
            console.error(err);
            setFormError("No s'ha pogut crear la temporada.");
        }
        finally {
            setCreating(false);
        }
    }
    async function handleArchive(seasonId) {
        const ok = window.confirm("Segur que vols arxivar aquesta temporada? Un cop arxivada no es pot editar.");
        if (!ok)
            return;
        try {
            await seasonsRepo.archive(seasonId, new Date().toISOString());
            await refresh();
            window.alert("Temporada arxivada. Fins a la pròxima!");
        }
        catch (err) {
            console.error(err);
            window.alert("No s'ha pogut arxivar la temporada.");
        }
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(PageHeader, { title: "Temporades", description: "Nom\u00E9s els superadmin poden crear o arxivar temporades." }), _jsxs("section", { className: "rounded-lg border border-slate-200 bg-white p-6", children: [_jsx("h2", { className: "mb-3 text-sm font-semibold text-slate-900", children: "Nova temporada" }), _jsxs("form", { onSubmit: handleCreate, className: "grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end", children: [_jsx(Field, { label: "Nom", children: _jsx(Input, { type: "text", required: true, value: name, onChange: (e) => setName(e.target.value), placeholder: "Ex. Temporada 2026 primavera" }) }), _jsx(Field, { label: "Data d'inici", children: _jsx(Input, { type: "date", required: true, value: startDate, onChange: (e) => setStartDate(e.target.value) }) }), _jsx(Button, { type: "submit", disabled: creating || hasActive, children: creating ? "Creant…" : "Crear" })] }), formError ? _jsx("div", { className: "mt-3", children: _jsx(ErrorMessage, { children: formError }) }) : null, hasActive ? (_jsx("p", { className: "mt-3 text-xs text-slate-500", children: "Nom\u00E9s pot haver-hi una temporada activa a la vegada." })) : null] }), _jsxs("section", { className: "rounded-lg border border-slate-200 bg-white", children: [_jsx("h2", { className: "border-b border-slate-100 px-6 py-3 text-sm font-semibold text-slate-900", children: "Llista" }), loading ? (_jsx("p", { className: "p-6 text-sm text-slate-500", children: "Carregant\u2026" })) : error ? (_jsx("div", { className: "p-6", children: _jsx(ErrorMessage, { children: error }) })) : seasons.length === 0 ? (_jsx("p", { className: "p-6 text-sm text-slate-500", children: "Encara no hi ha cap temporada. Crea la primera aqu\u00ED a sobre." })) : (_jsx("ul", { className: "divide-y divide-slate-100", children: seasons.map((s) => (_jsxs("li", { className: "flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-slate-900", children: s.name }), _jsxs("p", { className: "text-xs text-slate-500", children: ["Inici: ", s.startDate, s.endDate ? ` · Fi: ${s.endDate.slice(0, 10)}` : ""] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `rounded-full px-2 py-0.5 text-xs font-medium ${s.status === "active"
                                                ? "bg-emerald-100 text-emerald-800"
                                                : "bg-slate-100 text-slate-600"}`, children: s.status === "active" ? "Activa" : "Arxivada" }), _jsx(Button, { variant: currentSeason?.id === s.id ? "primary" : "secondary", onClick: () => selectSeason(s.id), children: currentSeason?.id === s.id ? "Seleccionada" : "Veure" }), s.status === "active" ? (_jsx(Button, { variant: "danger", onClick: () => handleArchive(s.id), children: "Arxivar" })) : null] })] }, s.id))) }))] })] }));
}
