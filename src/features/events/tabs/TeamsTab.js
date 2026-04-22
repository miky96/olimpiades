import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { Button, ErrorMessage, Field, Input } from "@/ui/forms";
import { matchesRepo, teamsRepo, eventsRepo } from "@/data";
import { competition } from "@/domain";
import { useSeasons } from "@/features/seasons/SeasonContext";
export function TeamsTab({ data, readOnly, onChanged }) {
    const { currentSeason } = useSeasons();
    const { event, teams, participants } = data;
    const seasonId = currentSeason?.id ?? "";
    const isDraft = event.status === "draft";
    const canEdit = !readOnly && isDraft;
    const [newName, setNewName] = useState("");
    const [newParticipantIds, setNewParticipantIds] = useState([]);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);
    const [initError, setInitError] = useState(null);
    const [initBusy, setInitBusy] = useState(false);
    const participantById = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants]);
    const assignedIds = useMemo(() => {
        const set = new Set();
        for (const t of teams)
            for (const pid of t.participantIds)
                set.add(pid);
        return set;
    }, [teams]);
    const availableParticipants = participants.filter((p) => p.active && !assignedIds.has(p.id));
    async function handleCreate(e) {
        e.preventDefault();
        setFormError(null);
        if (!canEdit)
            return;
        const name = newName.trim();
        if (!name) {
            setFormError("Dona un nom a l'equip.");
            return;
        }
        setSaving(true);
        try {
            await teamsRepo.create(seasonId, event.id, {
                name,
                participantIds: newParticipantIds,
            });
            setNewName("");
            setNewParticipantIds([]);
            await onChanged();
        }
        catch (err) {
            console.error(err);
            setFormError("No s'ha pogut crear l'equip.");
        }
        finally {
            setSaving(false);
        }
    }
    async function handleRenameTeam(team) {
        if (!canEdit)
            return;
        const next = window.prompt("Nou nom de l'equip:", team.name);
        if (!next || next.trim() === team.name)
            return;
        try {
            await teamsRepo.update(seasonId, event.id, team.id, { name: next.trim() });
            await onChanged();
        }
        catch (err) {
            console.error(err);
            window.alert("No s'ha pogut canviar el nom.");
        }
    }
    async function handleRemoveTeam(team) {
        if (!canEdit)
            return;
        const ok = window.confirm(`Eliminar l'equip "${team.name}"?`);
        if (!ok)
            return;
        try {
            await teamsRepo.remove(seasonId, event.id, team.id);
            await onChanged();
        }
        catch (err) {
            console.error(err);
            window.alert("No s'ha pogut eliminar l'equip.");
        }
    }
    async function handleAddMember(team, participantId) {
        if (!canEdit)
            return;
        if (team.participantIds.includes(participantId))
            return;
        try {
            await teamsRepo.update(seasonId, event.id, team.id, {
                participantIds: [...team.participantIds, participantId],
            });
            await onChanged();
        }
        catch (err) {
            console.error(err);
        }
    }
    async function handleRemoveMember(team, participantId) {
        if (!canEdit)
            return;
        try {
            await teamsRepo.update(seasonId, event.id, team.id, {
                participantIds: team.participantIds.filter((id) => id !== participantId),
            });
            await onChanged();
        }
        catch (err) {
            console.error(err);
        }
    }
    async function handleInitCompetition() {
        if (!canEdit)
            return;
        setInitError(null);
        const eligibleTeams = teams.filter((t) => t.participantIds.length > 0);
        if (eligibleTeams.length < 2) {
            setInitError("Es necessiten com a mínim 2 equips amb participants.");
            return;
        }
        if (event.format === "single_match" && eligibleTeams.length !== 2) {
            setInitError("El format \"Partit únic\" requereix exactament 2 equips.");
            return;
        }
        if (event.format === "group_stage_bracket" && eligibleTeams.length < 4) {
            setInitError("El format \"Lligueta + bracket\" necessita almenys 4 equips.");
            return;
        }
        const ok = window.confirm("Iniciar la competició? Un cop iniciada, els equips queden bloquejats.");
        if (!ok)
            return;
        setInitBusy(true);
        try {
            const result = competition.initCompetition(event.format, {
                eventId: event.id,
                teamIds: eligibleTeams.map((t) => t.id),
                config: event.config,
            });
            // Assignem groupId a cada equip quan és group_stage_bracket.
            if (event.format === "group_stage_bracket" && result.groups) {
                for (const g of result.groups) {
                    for (const tid of g.teamIds) {
                        await teamsRepo.update(seasonId, event.id, tid, { groupId: g.id });
                    }
                }
            }
            await matchesRepo.bulkCreate(seasonId, event.id, result.matches);
            await eventsRepo.update(seasonId, event.id, { status: "in_progress" });
            await onChanged();
        }
        catch (err) {
            console.error(err);
            setInitError(err instanceof Error ? err.message : "No s'ha pogut iniciar la competició.");
        }
        finally {
            setInitBusy(false);
        }
    }
    async function handleResetCompetition() {
        if (readOnly || event.status !== "in_progress")
            return;
        const ok = window.confirm("Reiniciar la competició? S'eliminaran tots els partits i podràs canviar els equips.");
        if (!ok)
            return;
        try {
            await matchesRepo.clearAll(seasonId, event.id);
            await eventsRepo.update(seasonId, event.id, { status: "draft" });
            await onChanged();
        }
        catch (err) {
            console.error(err);
            window.alert("No s'ha pogut reiniciar la competició.");
        }
    }
    return (_jsxs("div", { className: "space-y-6", children: [canEdit ? (_jsxs("section", { className: "rounded-lg border border-slate-200 bg-white p-6", children: [_jsx("h2", { className: "mb-3 text-sm font-semibold text-slate-900", children: "Nou equip" }), _jsxs("form", { onSubmit: handleCreate, className: "space-y-3", children: [_jsx(Field, { label: "Nom de l'equip", children: _jsx(Input, { type: "text", value: newName, onChange: (e) => setNewName(e.target.value), placeholder: "Ex. Equip A", required: true }) }), availableParticipants.length > 0 ? (_jsxs("div", { children: [_jsx("p", { className: "mb-1 text-sm font-medium text-slate-700", children: "Participants inicials (opcional)" }), _jsx("div", { className: "flex flex-wrap gap-2", children: availableParticipants.map((p) => {
                                            const selected = newParticipantIds.includes(p.id);
                                            return (_jsx("button", { type: "button", onClick: () => setNewParticipantIds((prev) => prev.includes(p.id)
                                                    ? prev.filter((id) => id !== p.id)
                                                    : [...prev, p.id]), className: `rounded-full border px-3 py-1 text-xs ${selected
                                                    ? "border-slate-900 bg-slate-900 text-white"
                                                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`, children: p.name }, p.id));
                                        }) })] })) : null, _jsxs("div", { className: "flex items-center justify-end gap-3", children: [formError ? _jsx(ErrorMessage, { children: formError }) : null, _jsx(Button, { type: "submit", disabled: saving, children: saving ? "Creant…" : "Crear equip" })] })] })] })) : null, _jsxs("section", { className: "rounded-lg border border-slate-200 bg-white", children: [_jsxs("h2", { className: "border-b border-slate-100 px-6 py-3 text-sm font-semibold text-slate-900", children: ["Equips (", teams.length, ")"] }), teams.length === 0 ? (_jsx("p", { className: "p-6 text-sm text-slate-500", children: "Encara no hi ha equips." })) : (_jsx("ul", { className: "divide-y divide-slate-100", children: teams.map((team) => (_jsxs("li", { className: "px-6 py-4 space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsx("p", { className: "font-medium text-slate-900", children: team.name }), canEdit ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { variant: "secondary", onClick: () => handleRenameTeam(team), children: "Reanomenar" }), _jsx(Button, { variant: "danger", onClick: () => handleRemoveTeam(team), children: "Eliminar" })] })) : null] }), _jsx(TeamMembers, { team: team, participantById: participantById, availableParticipants: availableParticipants, canEdit: canEdit, onAdd: (pid) => handleAddMember(team, pid), onRemove: (pid) => handleRemoveMember(team, pid) })] }, team.id))) }))] }), canEdit && teams.length > 0 ? (_jsxs("section", { className: "rounded-lg border border-slate-200 bg-white p-6", children: [_jsx("h2", { className: "mb-2 text-sm font-semibold text-slate-900", children: "Iniciar competici\u00F3" }), _jsx("p", { className: "mb-4 text-sm text-slate-600", children: "Un cop iniciada, es generaran els partits i no podr\u00E0s modificar els equips. Podr\u00E0s reiniciar-la si cal." }), initError ? (_jsx("div", { className: "mb-3", children: _jsx(ErrorMessage, { children: initError }) })) : null, _jsx(Button, { onClick: handleInitCompetition, disabled: initBusy, children: initBusy ? "Iniciant…" : "Iniciar competició" })] })) : null, !readOnly && event.status === "in_progress" ? (_jsxs("section", { className: "rounded-lg border border-amber-200 bg-amber-50 p-6", children: [_jsx("h2", { className: "mb-2 text-sm font-semibold text-amber-900", children: "Competici\u00F3 en curs" }), _jsx("p", { className: "mb-3 text-sm text-amber-800", children: "Si cal, pots reiniciar la competici\u00F3 per tornar a configurar els equips." }), _jsx(Button, { variant: "danger", onClick: handleResetCompetition, children: "Reiniciar competici\u00F3" })] })) : null] }));
}
function TeamMembers({ team, participantById, availableParticipants, canEdit, onAdd, onRemove, }) {
    const [pickerValue, setPickerValue] = useState("");
    return (_jsxs("div", { className: "space-y-2", children: [team.participantIds.length === 0 ? (_jsx("p", { className: "text-xs text-slate-500", children: "Cap participant assignat." })) : (_jsx("ul", { className: "flex flex-wrap gap-2", children: team.participantIds.map((pid) => {
                    const p = participantById.get(pid);
                    return (_jsxs("li", { className: "flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-800", children: [_jsx("span", { children: p?.name ?? pid }), canEdit ? (_jsx("button", { type: "button", onClick: () => onRemove(pid), className: "ml-1 text-slate-500 hover:text-red-600", "aria-label": "Treure participant", children: "\u00D7" })) : null] }, pid));
                }) })), canEdit && availableParticipants.length > 0 ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("select", { className: "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500", value: pickerValue, onChange: (e) => setPickerValue(e.target.value), children: [_jsx("option", { value: "", children: "Afegir participant\u2026" }), availableParticipants.map((p) => (_jsx("option", { value: p.id, children: p.name }, p.id)))] }), _jsx("button", { type: "button", disabled: !pickerValue, onClick: () => {
                            if (!pickerValue)
                                return;
                            onAdd(pickerValue);
                            setPickerValue("");
                        }, className: "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50", children: "Afegir" })] })) : null] }));
}
