import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { Button, ErrorMessage, Input } from "@/ui/forms";
import { attendanceRepo } from "@/data";
import { attendanceLabels, defaultsFor } from "@/domain/attendanceDefaults";
import { useSeasons } from "@/features/seasons/SeasonContext";
const STATUS_ORDER = [
    "present",
    "late",
    "absent_notified",
    "absent_unnotified",
];
export function AttendanceTab({ data, readOnly, onChanged }) {
    const { currentSeason } = useSeasons();
    const { event, participants, attendance, teams } = data;
    const seasonId = currentSeason?.id ?? "";
    const editable = !readOnly && event.status !== "finished";
    // Participants que juguen: actius + els que ja tenen assistència (per si un inactiu va venir).
    const eligibleParticipants = useMemo(() => {
        const seen = new Set();
        const list = [];
        for (const p of participants) {
            if (p.active) {
                list.push(p);
                seen.add(p.id);
            }
        }
        for (const a of attendance) {
            if (!seen.has(a.participantId)) {
                const p = participants.find((pp) => pp.id === a.participantId);
                if (p) {
                    list.push(p);
                    seen.add(p.id);
                }
            }
        }
        list.sort((a, b) => a.name.localeCompare(b.name));
        return list;
    }, [participants, attendance]);
    const initialRows = useMemo(() => {
        const byParticipant = new Map(attendance.map((a) => [a.participantId, a]));
        return eligibleParticipants.map((p) => {
            const existing = byParticipant.get(p.id);
            const status = existing?.status ?? "present";
            const defaults = defaultsFor(status);
            return {
                participant: p,
                status,
                bonusPoints: existing?.bonusPoints ?? defaults.bonusPoints,
                penaltyPoints: existing?.penaltyPoints ?? defaults.penaltyPoints,
                comment: existing?.comment ?? "",
                dirty: false,
                saving: false,
            };
        });
    }, [attendance, eligibleParticipants]);
    const [rows, setRows] = useState(initialRows);
    // Re-sync quan canvien les dades externes.
    const [lastKey, setLastKey] = useState("");
    const currentKey = `${attendance.length}-${eligibleParticipants.length}-${event.id}`;
    if (currentKey !== lastKey) {
        setRows(initialRows);
        setLastKey(currentKey);
    }
    function updateRow(participantId, patch) {
        setRows((prev) => prev.map((r) => r.participant.id === participantId
            ? { ...r, ...patch, dirty: true }
            : r));
    }
    function handleStatusChange(participantId, status) {
        const defaults = defaultsFor(status);
        setRows((prev) => prev.map((r) => {
            if (r.participant.id !== participantId)
                return r;
            // Aplica els valors per defecte, però només si l'usuari no els ha tocat.
            return {
                ...r,
                status,
                bonusPoints: defaults.bonusPoints,
                penaltyPoints: defaults.penaltyPoints,
                dirty: true,
            };
        }));
    }
    async function saveRow(row) {
        if (!editable)
            return;
        setRows((prev) => prev.map((r) => r.participant.id === row.participant.id
            ? { ...r, saving: true, error: undefined }
            : r));
        try {
            await attendanceRepo.upsert(seasonId, event.id, {
                participantId: row.participant.id,
                status: row.status,
                bonusPoints: Number.isFinite(row.bonusPoints) ? row.bonusPoints : 0,
                penaltyPoints: Number.isFinite(row.penaltyPoints) ? row.penaltyPoints : 0,
                comment: row.comment.trim() || undefined,
            });
            setRows((prev) => prev.map((r) => r.participant.id === row.participant.id
                ? { ...r, saving: false, dirty: false }
                : r));
            await onChanged();
        }
        catch (err) {
            console.error(err);
            setRows((prev) => prev.map((r) => r.participant.id === row.participant.id
                ? { ...r, saving: false, error: "No s'ha pogut desar." }
                : r));
        }
    }
    async function saveAllDirty() {
        if (!editable)
            return;
        const dirty = rows.filter((r) => r.dirty && !r.saving);
        for (const r of dirty) {
            // Desat seqüencial per simplicitat i evitar càrregues massives.
            // Si el nombre creix, passar a Promise.all.
            // eslint-disable-next-line no-await-in-loop
            await saveRow(r);
        }
    }
    const teamNameOf = useMemo(() => {
        const map = new Map();
        for (const t of teams) {
            for (const pid of t.participantIds)
                map.set(pid, t.name);
        }
        return map;
    }, [teams]);
    const dirtyCount = rows.filter((r) => r.dirty).length;
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsx("p", { className: "text-sm text-slate-600", children: "Marca qui ha vingut i ajusta bonus / penalitzaci\u00F3. Els valors per defecte s'apliquen segons l'estat seleccionat; pots sobreescriure'ls." }), editable ? (_jsx(Button, { onClick: saveAllDirty, disabled: dirtyCount === 0, children: dirtyCount > 0 ? `Desar ${dirtyCount} canvi${dirtyCount === 1 ? "" : "s"}` : "Res per desar" })) : null] }), rows.length === 0 ? (_jsx("p", { className: "rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500", children: "No hi ha participants actius en aquesta temporada." })) : (_jsx("div", { className: "overflow-x-auto rounded-lg border border-slate-200 bg-white", children: _jsxs("table", { className: "min-w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 text-left text-xs font-medium text-slate-600", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-2", children: "Participant" }), _jsx("th", { className: "px-4 py-2", children: "Equip" }), _jsx("th", { className: "px-4 py-2", children: "Estat" }), _jsx("th", { className: "px-4 py-2", children: "Bonus" }), _jsx("th", { className: "px-4 py-2", children: "Penalitzaci\u00F3" }), _jsx("th", { className: "px-4 py-2", children: "Comentari" }), editable ? _jsx("th", { className: "px-4 py-2 text-right", children: "Accions" }) : null] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: rows.map((row) => (_jsxs("tr", { className: row.dirty ? "bg-amber-50" : "", children: [_jsx("td", { className: "px-4 py-2 font-medium text-slate-900", children: row.participant.name }), _jsx("td", { className: "px-4 py-2 text-xs text-slate-500", children: teamNameOf.get(row.participant.id) ?? "—" }), _jsx("td", { className: "px-4 py-2", children: _jsx("select", { disabled: !editable, value: row.status, onChange: (e) => handleStatusChange(row.participant.id, e.target.value), className: "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50", children: STATUS_ORDER.map((s) => (_jsx("option", { value: s, children: attendanceLabels[s] }, s))) }) }), _jsx("td", { className: "px-4 py-2", children: _jsx(Input, { type: "number", step: 1, disabled: !editable, value: row.bonusPoints, onChange: (e) => updateRow(row.participant.id, {
                                                bonusPoints: Number(e.target.value),
                                            }), className: "w-20" }) }), _jsx("td", { className: "px-4 py-2", children: _jsx(Input, { type: "number", step: 1, disabled: !editable, value: row.penaltyPoints, onChange: (e) => updateRow(row.participant.id, {
                                                penaltyPoints: Number(e.target.value),
                                            }), className: "w-20" }) }), _jsx("td", { className: "px-4 py-2", children: _jsx(Input, { type: "text", disabled: !editable, value: row.comment, onChange: (e) => updateRow(row.participant.id, { comment: e.target.value }), placeholder: "Motiu / nota" }) }), editable ? (_jsxs("td", { className: "px-4 py-2 text-right", children: [_jsx(Button, { variant: "secondary", onClick: () => saveRow(row), disabled: !row.dirty || row.saving, children: row.saving ? "Desant…" : "Desar" }), row.error ? (_jsx("div", { className: "mt-1", children: _jsx(ErrorMessage, { children: row.error }) })) : null] })) : null] }, row.participant.id))) })] }) })), _jsx(AttendanceSummary, { rows: rows })] }));
}
function AttendanceSummary({ rows }) {
    const counts = STATUS_ORDER.reduce((acc, s) => ({ ...acc, [s]: 0 }), {
        present: 0,
        late: 0,
        absent_notified: 0,
        absent_unnotified: 0,
    });
    for (const r of rows)
        counts[r.status] += 1;
    return (_jsx("div", { className: "flex flex-wrap gap-3 text-xs text-slate-600", children: STATUS_ORDER.map((s) => (_jsxs("span", { className: "rounded-full bg-slate-100 px-3 py-1", children: [attendanceLabels[s], ": ", _jsx("strong", { children: counts[s] })] }, s))) }));
}
