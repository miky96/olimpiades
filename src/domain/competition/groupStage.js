/**
 * Fase de grups (round-robin) per al format "group_stage_bracket".
 *
 * Regles:
 *  - Mida de grup fixa (3 o 4) escollida per l'admin.
 *  - Els equips es reparteixen aleatòriament en grups.
 *  - Dins de cada grup es juga round-robin (tots contra tots).
 *  - Els N primers de cada grup passen a la fase d'eliminatòria.
 *  - Si el nombre d'equips no és múltiple de groupSize, la resta forma l'últim
 *    grup (acceptem 2 o 3 equips en aquest cas). Si no és possible formar grup
 *    vàlid (menys de 3 equips totals), l'admin ha d'escollir un altre format.
 */
import { shuffle } from "./shuffle";
let counter = 0;
const defaultMakeId = () => `match_${Date.now().toString(36)}_${(counter++).toString(36)}`;
export const MIN_TEAMS_FOR_GROUP_STAGE = 4;
/** Reparteix equips en grups de mida `groupSize`. */
export function buildGroups(teamIds, groupSize, rng) {
    if (teamIds.length < MIN_TEAMS_FOR_GROUP_STAGE) {
        throw new Error(`El format "lligueta + bracket" requereix almenys ${MIN_TEAMS_FOR_GROUP_STAGE} equips.`);
    }
    const shuffled = shuffle(teamIds, rng);
    const groups = [];
    let groupIndex = 0;
    for (let i = 0; i < shuffled.length; i += groupSize) {
        const members = shuffled.slice(i, i + groupSize);
        // Si l'últim grup queda amb 1 sol equip, l'afegim al grup anterior
        // per evitar grups unipersonals (cas edge amb groupSize=4 i N%4 === 1).
        if (members.length === 1 && groups.length > 0) {
            groups[groups.length - 1].teamIds.push(members[0]);
            continue;
        }
        groups.push({ id: `group_${String.fromCharCode(65 + groupIndex)}`, teamIds: members });
        groupIndex += 1;
    }
    return groups;
}
/** Genera tots els enfrontaments round-robin per a un grup donat. */
export function generateRoundRobinMatches(group, eventId, makeId = defaultMakeId) {
    const matches = [];
    const teams = group.teamIds;
    for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
            matches.push({
                id: makeId(),
                eventId,
                phase: "group",
                groupId: group.id,
                teamAId: teams[i],
                teamBId: teams[j],
                winnerTeamId: null,
            });
        }
    }
    return matches;
}
/**
 * Genera la fase de grups completa: crea els grups + els matches round-robin.
 */
export function generateGroupStage(teamIds, opts) {
    const { eventId, groupSize, rng, makeId = defaultMakeId } = opts;
    const groups = buildGroups(teamIds, groupSize, rng);
    const matches = groups.flatMap((g) => generateRoundRobinMatches(g, eventId, makeId));
    return { groups, matches };
}
export function groupStandings(group, matches) {
    const byTeam = new Map();
    for (const teamId of group.teamIds) {
        byTeam.set(teamId, {
            teamId,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            points: 0,
        });
    }
    for (const m of matches) {
        if (m.groupId !== group.id)
            continue;
        if (!m.teamAId || !m.teamBId)
            continue;
        const a = byTeam.get(m.teamAId);
        const b = byTeam.get(m.teamBId);
        if (!a || !b)
            continue;
        if (m.winnerTeamId === m.teamAId) {
            a.played += 1;
            b.played += 1;
            a.wins += 1;
            b.losses += 1;
            a.points += 3;
        }
        else if (m.winnerTeamId === m.teamBId) {
            a.played += 1;
            b.played += 1;
            b.wins += 1;
            a.losses += 1;
            b.points += 3;
        }
        else if (m.winnerTeamId === null && m.scoreA != null && m.scoreB != null && m.scoreA === m.scoreB) {
            // Empat explícit
            a.played += 1;
            b.played += 1;
            a.draws += 1;
            b.draws += 1;
            a.points += 1;
            b.points += 1;
        }
    }
    return [...byTeam.values()].sort((x, y) => y.points - x.points);
}
