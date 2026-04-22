import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/ui/PageHeader";
import { Button, ErrorMessage, Field, Input } from "@/ui/forms";
import { participantsRepo } from "@/data";
import { useSeasons } from "@/features/seasons/SeasonContext";
import { useAuth, hasRole } from "@/features/auth/AuthContext";
export function ParticipantsPage() {
    const { currentSeason } = useSeasons();
    const { appUser } = useAuth();
    const canWrite = hasRole(appUser, ["admin", "superadmin"]);
    const isArchived = currentSeason?.status === "archived";
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);
    const load = useCallback(async () => {
        if (!currentSeason)
            return;
        setLoading(true);
        setError(null);
        try {
            const list = await participantsRepo.list(currentSeason.id);
            list.sort((a, b) => a.name.localeCompare(b.name));
            setParticipants(list);
        }
        catch (e) {
            console.error(e);
            setError("No s'han pogut carregar els participants.");
        }
        finally {
            setLoading(false);
        }
    }, [currentSeason]);
    useEffect(() => {
        void load();
    }, [load]);
    if (!currentSeason) {
        return (_jsxs("div", { children: [_jsx(PageHeader, { title: "Participants" }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600", children: ["Cap temporada seleccionada. Crea'n una a ", _jsx("em", { children: "Temporades" }), "."] })] }));
    }
    async function handleCreate(e) {
        e.preventDefault();
        if (!canWrite || !currentSeason)
            return;
        const name = newName.trim();
        if (!name)
            return;
        setCreating(true);
        try {
            await participantsRepo.create(currentSeason.id, { name, active: true });
            setNewName("");
            await load();
        }
        catch (e) {
            console.error(e);
            setError("No s'ha pogut crear el participant.");
        }
        finally {
            setCreating(false);
        }
    }
    async function handleToggleActive(p) {
        if (!canWrite || !currentSeason)
            return;
        try {
            await participantsRepo.update(currentSeason.id, p.id, { active: !p.active });
            await load();
        }
        catch (e) {
            console.error(e);
        }
    }
    async function handleRename(p) {
        if (!canWrite || !currentSeason)
            return;
        const next = window.prompt("Nou nom:", p.name);
        if (!next || next.trim() === p.name)
            return;
        try {
            await participantsRepo.update(currentSeason.id, p.id, { name: next.trim() });
            await load();
        }
        catch (e) {
            console.error(e);
        }
    }
    async function handleRemove(p) {
        if (!canWrite || !currentSeason)
            return;
        const ok = window.confirm(`Eliminar ${p.name}? Aquesta acció és irreversible.`);
        if (!ok)
            return;
        try {
            await participantsRepo.remove(currentSeason.id, p.id);
            await load();
        }
        catch (e) {
            console.error(e);
        }
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(PageHeader, { title: "Participants", description: `Temporada: ${currentSeason.name}${isArchived ? " (arxivada, només lectura)" : ""}` }), canWrite && !isArchived ? (_jsxs("section", { className: "rounded-lg border border-slate-200 bg-white p-6", children: [_jsx("h2", { className: "mb-3 text-sm font-semibold text-slate-900", children: "Nou participant" }), _jsxs("form", { onSubmit: handleCreate, className: "flex flex-wrap items-end gap-3", children: [_jsx(Field, { label: "Nom", className: "flex-1 min-w-[200px]", children: _jsx(Input, { type: "text", required: true, value: newName, onChange: (e) => setNewName(e.target.value), placeholder: "Nom i cognom" }) }), _jsx(Button, { type: "submit", disabled: creating, children: creating ? "Afegint…" : "Afegir" })] })] })) : null, _jsxs("section", { className: "rounded-lg border border-slate-200 bg-white", children: [_jsxs("h2", { className: "border-b border-slate-100 px-6 py-3 text-sm font-semibold text-slate-900", children: ["Llista (", participants.length, ")"] }), loading ? (_jsx("p", { className: "p-6 text-sm text-slate-500", children: "Carregant\u2026" })) : error ? (_jsx("div", { className: "p-6", children: _jsx(ErrorMessage, { children: error }) })) : participants.length === 0 ? (_jsx("p", { className: "p-6 text-sm text-slate-500", children: "Encara no hi ha participants." })) : (_jsx("ul", { className: "divide-y divide-slate-100", children: participants.map((p) => (_jsxs("li", { className: "flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-slate-900", children: p.name }), !p.active ? (_jsx("span", { className: "text-xs text-slate-500", children: "Inactiu" })) : null] }), canWrite && !isArchived ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { variant: "secondary", onClick: () => handleRename(p), children: "Reanomenar" }), _jsx(Button, { variant: "secondary", onClick: () => handleToggleActive(p), children: p.active ? "Desactivar" : "Activar" }), _jsx(Button, { variant: "danger", onClick: () => handleRemove(p), children: "Eliminar" })] })) : null] }, p.id))) }))] })] }));
}
