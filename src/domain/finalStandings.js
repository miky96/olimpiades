/**
 * Càlcul de posicions finals d'un esdeveniment a partir dels matches.
 *
 * Regla simple (adequada per a l'MVP):
 *  - Per a bracket / group_stage_bracket, la "puntuació" de cada equip és
 *    la ronda més alta on va guanyar (o rebre un bye amb winner prefixat).
 *  - Per a single_match, el guanyador rep score=1 i el perdedor 0.
 *  - Els equips que no van passar la fase de grups tenen score=0 (posició final
 *    més baixa), que equival a 0 punts segons les regles de l'MVP. L'ordre
 *    relatiu entre ells no afecta els punts, així que ho deixem com un sol bucket.
 *  - Els empats es resolen amb posicions denses (1,1,2,...).
 */
import { assignDensePositions } from "./positions";
/** Calcula la "profunditat" que ha assolit un equip a la fase eliminatòria. */
export function bracketReachScore(teamId, matches) {
    let reach = 0;
    for (const m of matches) {
        if (m.phase === "group")
            continue;
        if (m.winnerTeamId !== teamId)
            continue;
        const r = m.phase === "single" ? 1 : m.round ?? 0;
        if (r > reach)
            reach = r;
    }
    return reach;
}
/**
 * Retorna les posicions finals per a una llista d'equips i els seus matches.
 * Equips sense victòries a fase eliminatòria queden tots empatats a la darrera posició.
 */
export function computeFinalStandings(teamIds, matches) {
    const inputs = teamIds.map((teamId) => ({
        teamId,
        score: bracketReachScore(teamId, matches),
    }));
    return assignDensePositions(inputs);
}
/**
 * Comprova si tots els matches "jugables" tenen guanyador.
 * Un match és jugable si té els dos equips assignats (teamBId != null).
 * Els byes (teamBId = null) ja tenen winner prefixat.
 */
export function areAllMatchesDecided(matches) {
    return matches.every((m) => m.winnerTeamId !== null || m.teamBId === null);
}
