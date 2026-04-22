/**
 * Entry point del motor de competició.
 * Exposa funcions pures per generar el "kick-off" de cada format.
 */
import { generateFirstRoundBracket } from "./bracket";
import { generateGroupStage } from "./groupStage";
import { generateSingleMatch } from "./singleMatch";
/**
 * Inicialitza la competició segons el format escollit.
 * - single_match       → 1 partit únic.
 * - bracket            → primera ronda de l'eliminatòria.
 * - group_stage_bracket→ tots els matches round-robin de la fase de grups.
 */
export function initCompetition(format, opts) {
    switch (format) {
        case "single_match":
            return {
                matches: generateSingleMatch(opts.teamIds, {
                    eventId: opts.eventId,
                    makeId: opts.makeId,
                }),
            };
        case "bracket":
            return {
                matches: generateFirstRoundBracket(opts.teamIds, {
                    eventId: opts.eventId,
                    rng: opts.rng,
                    makeId: opts.makeId,
                }),
            };
        case "group_stage_bracket": {
            const groupSize = opts.config?.groupSize ?? 4;
            const { groups, matches } = generateGroupStage(opts.teamIds, {
                eventId: opts.eventId,
                groupSize,
                rng: opts.rng,
                makeId: opts.makeId,
            });
            return { matches, groups };
        }
        default: {
            const _exhaustive = format;
            throw new Error(`Format no suportat: ${_exhaustive}`);
        }
    }
}
