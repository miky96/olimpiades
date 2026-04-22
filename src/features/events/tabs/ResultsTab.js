import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { Button, ErrorMessage } from "@/ui/forms";
import { eventsRepo, matchesRepo } from "@/data";
import { advanceBracket, areAllMatchesDecided, calculateEventPoints, computeFinalStandings, generateFirstRoundBracket, groupStandings, } from "@/domain";
import { useSeasons } from "@/features/seasons/SeasonContext";
const PHASE_ORDER = [
    "group",
    "round_of_16",
    "quarter",
    "semi",
    "final",
    "third_place",
    "single",
];
const PHASE_LABELS = {
    group: "Fase de grups",
    round_of_16: "Vuitens",
    quarter: "Quarts",
    semi: "Semifinals",
    final: "Final",
    third_place: "Tercer i quart",
    single: "Partit únic",
};
export function ResultsTab({ data, readOnly, onChanged }) {
    const { currentSeason } = useSeasons();
    const { event, matches, teams, attendance } = data;
    const seasonId = currentSeason?.id ?? "";
    const editable = !readOnly && event.status === "in_progress";
    const [busyMatchId, setBusyMatchId] = useState(null);
    const [error, setError] = useState(null);
    const [advancing, setAdvancing] = useState(false);
    const [finalizing, setFinalizing] = useState(false);
    const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
    const matchesByPhase = useMemo(() => {
        const groups = new Map();
        for (const m of matches) {
            if (!groups.has(m.phase))
                groups.set(m.phase, []);
            groups.get(m.phase).push(m);
        }
        return groups;
    }, [matches]);
    // Bracket: ronda actual = màxima ronda present, excloent group phase.
    const currentBracketRound = useMemo(() => {
        let max = 0;
        for (const m of matches) {
            if (m.phase === "group")
                continue;
            if ((m.round ?? 0) > max)
                max = m.round ?? 0;
        }
        return max;
    }, [matches]);
    const currentRoundMatches = useMemo(() => matches.filter((m) => m.phase !== "group" && (m.round ?? 0) === currentBracketRound), [matches, currentBracketRound]);
    const currentRoundComplete = currentRoundMatches.length > 0 &&
        areAllMatchesDecided(currentRoundMatches);
    const hasFinalMatch = currentRoundMatches.some((m) => m.phase === "final" || m.phase === "single");
    const canAdvanceBracket = editable &&
        currentRoundMatches.length > 1 &&
        currentRoundComplete &&
        !hasFinalMatch;
    // Fase de grups: detectem si tots els matches de group són decidits
    const groupMatches = matchesByPhase.get("group") ?? [];
    const hasGroupStage = groupMatches.length > 0;
    const groupStageComplete = hasGroupStage && areAllMatchesDecided(groupMatches);
    const bracketStarted = matches.some((m) => m.phase !== "group");
    const canBuildBracketFromGroups = editable && hasGroupStage && groupStageComplete && !bracketStarted;
    const allDecided = matches.length > 0 && areAllMatchesDecided(matches);
    const canFinalize = editable && allDecided && hasFinalMatch && currentRoundMatches.every((m) => m.winnerTeamId);
    async function handleSetWinner(m, winnerTeamId, opts) {
        if (!editable)
            return;
        setBusyMatchId(m.id);
        setError(null);
        try {
            await matchesRepo.setResult(seasonId, event.id, m.id, {
                winnerTeamId,
                scoreA: opts?.scoreA,
                scoreB: opts?.scoreB,
            });
            await onChanged();
        }
        catch (err) {
            console.error(err);
            setError("No s'ha pogut desar el resultat.");
        }
        finally {
            setBusyMatchId(null);
        }
    }
    async function handleAdvanceBracket() {
        if (!canAdvanceBracket)
            return;
        setAdvancing(true);
        setError(null);
        try {
            const next = advanceBracket(currentRoundMatches, { eventId: event.id });
            if (next.length === 0) {
                setError("Encara no es pot avançar (falten resultats).");
                return;
            }
            await matchesRepo.bulkCreate(seasonId, event.id, next);
            await onChanged();
        }
        catch (err) {
            console.error(err);
            setError("No s'ha pogut generar la següent ronda.");
        }
        finally {
            setAdvancing(false);
        }
    }
    async function handleBuildBracketFromGroups() {
        if (!canBuildBracketFromGroups)
            return;
        setAdvancing(true);
        setError(null);
        try {
            const qualifiers = pickQualifiers(teams, groupMatches, event.config.qualifiersPerGroup ?? 2);
            if (qualifiers.length < 2) {
                setError("Calen almenys 2 equips qualificats per construir el bracket.");
                return;
            }
            const bracketMatches = generateFirstRoundBracket(qualifiers, {
                eventId: event.id,
            });
            await matchesRepo.bulkCreate(seasonId, event.id, bracketMatches);
            await onChanged();
        }
        catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "No s'ha pogut generar el bracket.");
        }
        finally {
            setAdvancing(false);
        }
    }
    async function handleFinalize() {
        if (!canFinalize)
            return;
        const ok = window.confirm("Finalitzar l'esdeveniment? Es calcularan i desaran les posicions i punts.");
        if (!ok)
            return;
        setFinalizing(true);
        setError(null);
        try {
            const standings = computeFinalStandings(teams.map((t) => t.id), matches);
            const attendanceByParticipant = Object.fromEntries(attendance.map((a) => [a.participantId, a]));
            const breakdown = calculateEventPoints(standings, teams, attendanceByParticipant);
            await eventsRepo.update(seasonId, event.id, {
                status: "finished",
                finalStandings: standings,
                pointsBreakdown: breakdown,
            });
            await onChanged();
        }
        catch (err) {
            console.error(err);
            setError("No s'ha pogut finalitzar l'esdeveniment.");
        }
        finally {
            setFinalizing(false);
        }
    }
    async function handleReopen() {
        if (readOnly)
            return;
        const ok = window.confirm("Reobrir l'esdeveniment? Els punts es recalcularan quan el tornis a finalitzar.");
        if (!ok)
            return;
        try {
            await eventsRepo.update(seasonId, event.id, {
                status: "in_progress",
                finalStandings: [],
                pointsBreakdown: [],
            });
            await onChanged();
        }
        catch (err) {
            console.error(err);
            setError("No s'ha pogut reobrir l'esdeveniment.");
        }
    }
    if (matches.length === 0) {
        return (_jsxs("div", { className: "rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500", children: ["Encara no s'ha iniciat la competici\u00F3. Ves a la tab ", _jsx("em", { children: "Equips" }), " per crear equips i comen\u00E7ar."] }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [error ? _jsx(ErrorMessage, { children: error }) : null, PHASE_ORDER.map((phase) => {
                const list = matchesByPhase.get(phase);
                if (!list || list.length === 0)
                    return null;
                return (_jsxs("section", { className: "rounded-lg border border-slate-200 bg-white", children: [_jsx("h2", { className: "border-b border-slate-100 px-6 py-3 text-sm font-semibold text-slate-900", children: PHASE_LABELS[phase] }), phase === "group" ? (_jsx(GroupPhaseView, { matches: list, teams: teams, teamById: teamById, editable: editable, busyMatchId: busyMatchId, onSetResult: handleSetWinner })) : (_jsx("ul", { className: "divide-y divide-slate-100", children: list
                                .slice()
                                .sort((a, b) => (a.round ?? 0) - (b.round ?? 0))
                                .map((m) => (_jsx(MatchRow, { match: m, teamById: teamById, editable: editable, busy: busyMatchId === m.id, onSetWinner: (winner) => handleSetWinner(m, winner) }, m.id))) }))] }, phase));
            }), editable ? (_jsxs("section", { className: "flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-6", children: [canBuildBracketFromGroups ? (_jsx(Button, { onClick: handleBuildBracketFromGroups, disabled: advancing, children: advancing ? "Generant…" : "Generar bracket amb qualificats" })) : null, canAdvanceBracket ? (_jsx(Button, { onClick: handleAdvanceBracket, disabled: advancing, children: advancing ? "Avançant…" : "Avançar a la següent ronda" })) : null, canFinalize ? (_jsx(Button, { variant: "primary", onClick: handleFinalize, disabled: finalizing, children: finalizing ? "Finalitzant…" : "Finalitzar i calcular punts" })) : null, !canBuildBracketFromGroups && !canAdvanceBracket && !canFinalize ? (_jsx("p", { className: "text-sm text-slate-500", children: "Introdueix els resultats per poder avan\u00E7ar." })) : null] })) : null, event.status === "finished" ? (_jsx(FinalSummary, { data: data, onReopen: readOnly ? undefined : handleReopen })) : null] }));
}
function MatchRow({ match, teamById, editable, busy, onSetWinner, }) {
    const teamA = match.teamAId ? teamById.get(match.teamAId) : null;
    const teamB = match.teamBId ? teamById.get(match.teamBId) : null;
    const isBye = match.teamBId === null;
    return (_jsx("li", { className: "px-6 py-3", children: _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "flex-1", children: [_jsx(TeamLine, { name: teamA?.name ?? "—", isWinner: match.winnerTeamId === match.teamAId }), isBye ? (_jsx("p", { className: "text-xs italic text-slate-500", children: "Bye (passa directament)" })) : (_jsx(TeamLine, { name: teamB?.name ?? "—", isWinner: match.winnerTeamId === match.teamBId }))] }), !isBye && editable ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Button, { variant: match.winnerTeamId === match.teamAId ? "primary" : "secondary", onClick: () => onSetWinner(match.teamAId), disabled: busy, children: ["Guanya ", teamA?.name ?? "A"] }), _jsxs(Button, { variant: match.winnerTeamId === match.teamBId ? "primary" : "secondary", onClick: () => onSetWinner(match.teamBId), disabled: busy, children: ["Guanya ", teamB?.name ?? "B"] })] })) : null] }) }));
}
function TeamLine({ name, isWinner }) {
    return (_jsxs("p", { className: `text-sm ${isWinner ? "font-semibold text-emerald-700" : "text-slate-700"}`, children: [isWinner ? "✓ " : "", name] }));
}
function GroupPhaseView({ matches, teams, teamById, editable, busyMatchId, onSetResult, }) {
    // Agrupar per groupId
    const byGroup = new Map();
    for (const m of matches) {
        const gid = m.groupId ?? "group_?";
        if (!byGroup.has(gid))
            byGroup.set(gid, []);
        byGroup.get(gid).push(m);
    }
    const groupIds = [...byGroup.keys()].sort();
    return (_jsx("div", { className: "divide-y divide-slate-100", children: groupIds.map((gid) => {
            const gMatches = byGroup.get(gid);
            const groupTeams = teams.filter((t) => t.groupId === gid);
            const standings = groupTeams.length > 0
                ? groupStandings({ id: gid, teamIds: groupTeams.map((t) => t.id) }, gMatches)
                : [];
            return (_jsxs("div", { className: "px-6 py-4 space-y-3", children: [_jsxs("h3", { className: "text-sm font-semibold text-slate-900", children: ["Grup ", gid.replace("group_", "")] }), _jsx("ul", { className: "divide-y divide-slate-100 rounded-md border border-slate-200", children: gMatches.map((m) => {
                            const teamA = m.teamAId ? teamById.get(m.teamAId) : null;
                            const teamB = m.teamBId ? teamById.get(m.teamBId) : null;
                            const busy = busyMatchId === m.id;
                            const isDraw = m.winnerTeamId === null &&
                                m.scoreA != null &&
                                m.scoreB != null &&
                                m.scoreA === m.scoreB;
                            return (_jsx("li", { className: "px-4 py-2 text-sm", children: _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx(TeamLine, { name: teamA?.name ?? "—", isWinner: m.winnerTeamId === m.teamAId }), _jsx(TeamLine, { name: teamB?.name ?? "—", isWinner: m.winnerTeamId === m.teamBId }), isDraw ? (_jsx("p", { className: "text-xs italic text-slate-500", children: "Empat" })) : null] }), editable ? (_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs(Button, { variant: m.winnerTeamId === m.teamAId ? "primary" : "secondary", onClick: () => onSetResult(m, m.teamAId), disabled: busy, children: ["Guanya ", teamA?.name ?? "A"] }), _jsxs(Button, { variant: m.winnerTeamId === m.teamBId ? "primary" : "secondary", onClick: () => onSetResult(m, m.teamBId), disabled: busy, children: ["Guanya ", teamB?.name ?? "B"] }), _jsx(Button, { variant: isDraw ? "primary" : "secondary", onClick: () => onSetResult(m, null, { scoreA: 1, scoreB: 1 }), disabled: busy, children: "Empat" })] })) : null] }) }, m.id));
                        }) }), standings.length > 0 ? (_jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { className: "text-slate-500", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left", children: "Equip" }), _jsx("th", { children: "PJ" }), _jsx("th", { children: "G" }), _jsx("th", { children: "E" }), _jsx("th", { children: "P" }), _jsx("th", { children: "Pts" })] }) }), _jsx("tbody", { children: standings.map((s) => (_jsxs("tr", { className: "text-slate-700", children: [_jsx("td", { children: teamById.get(s.teamId)?.name ?? s.teamId }), _jsx("td", { className: "text-center", children: s.played }), _jsx("td", { className: "text-center", children: s.wins }), _jsx("td", { className: "text-center", children: s.draws }), _jsx("td", { className: "text-center", children: s.losses }), _jsx("td", { className: "text-center font-semibold", children: s.points })] }, s.teamId))) })] })) : null] }, gid));
        }) }));
}
function FinalSummary({ data, onReopen, }) {
    const { event, teams, participants } = data;
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const participantById = new Map(participants.map((p) => [p.id, p]));
    return (_jsxs("section", { className: "rounded-lg border border-emerald-200 bg-emerald-50 p-6 space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsx("h2", { className: "text-sm font-semibold text-emerald-900", children: "Esdeveniment finalitzat" }), onReopen ? (_jsx(Button, { variant: "secondary", onClick: onReopen, children: "Reobrir" })) : null] }), event.finalStandings && event.finalStandings.length > 0 ? (_jsxs("div", { children: [_jsx("h3", { className: "mb-2 text-xs font-medium uppercase tracking-wide text-emerald-800", children: "Classificaci\u00F3" }), _jsx("ol", { className: "space-y-1 text-sm text-slate-800", children: event.finalStandings.map((s) => (_jsxs("li", { children: [_jsxs("strong", { children: [s.position, "."] }), " ", s.teamIds.map((tid) => teamById.get(tid)?.name ?? tid).join(", ")] }, s.position))) })] })) : null, event.pointsBreakdown && event.pointsBreakdown.length > 0 ? (_jsxs("div", { className: "overflow-x-auto", children: [_jsx("h3", { className: "mb-2 text-xs font-medium uppercase tracking-wide text-emerald-800", children: "Punts per participant" }), _jsxs("table", { className: "min-w-full text-xs", children: [_jsx("thead", { className: "text-slate-500", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left", children: "Participant" }), _jsx("th", { children: "Posici\u00F3" }), _jsx("th", { children: "Bonus" }), _jsx("th", { children: "Penalitzaci\u00F3" }), _jsx("th", { children: "Total" })] }) }), _jsx("tbody", { className: "divide-y divide-emerald-100", children: event.pointsBreakdown
                                    .slice()
                                    .sort((a, b) => b.total - a.total)
                                    .map((b) => (_jsxs("tr", { className: "text-slate-700", children: [_jsx("td", { children: participantById.get(b.participantId)?.name ?? b.participantId }), _jsx("td", { className: "text-center", children: b.positionPoints }), _jsx("td", { className: "text-center", children: b.bonusPoints }), _jsx("td", { className: "text-center", children: b.penaltyPoints }), _jsx("td", { className: "text-center font-semibold", children: b.total })] }, b.participantId))) })] })] })) : null] }));
}
/** Selecciona els qualificats segons standings de cada grup. */
function pickQualifiers(teams, groupMatches, qualifiersPerGroup) {
    const byGroup = new Map();
    for (const t of teams) {
        if (!t.groupId)
            continue;
        if (!byGroup.has(t.groupId))
            byGroup.set(t.groupId, []);
        byGroup.get(t.groupId).push(t.id);
    }
    const qualifiers = [];
    for (const [gid, teamIds] of byGroup) {
        const standings = groupStandings({ id: gid, teamIds }, groupMatches);
        for (let i = 0; i < qualifiersPerGroup && i < standings.length; i++) {
            qualifiers.push(standings[i].teamId);
        }
    }
    return qualifiers;
}
