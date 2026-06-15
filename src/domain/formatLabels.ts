import type { EventFormat, EventFormatConfig, OlimpiadaEvent } from "./types";

export const formatLabels: Record<EventFormat, string> = {
  single_match: "Partit únic",
  bracket: "Eliminatòria (bracket)",
  group_stage_bracket: "Lligueta + eliminatòria",
  league_only: "Només lligueta",
  rotating_singles: "Partits rotatius (individual)",
};

export const formatDescriptions: Record<EventFormat, string> = {
  single_match: "Un sol partit entre dues persones o equips.",
  bracket: "Eliminatòria directa 1 vs 1 amb byes si cal.",
  group_stage_bracket:
    "Lligueta prèvia en grups de 3 o 4 + eliminatòria amb els classificats.",
  league_only:
    "Tots contra tots en una sola lligueta. Guanya qui acaba amb més punts.",
  rotating_singles:
    "2 equips, partits encadenats. Després de cada partit pots regenerar els equips. La classificació final és individual: cada participant suma 3 punts per partit guanyat (0 per perdut).",
};

/**
 * Formats que poden activar el "mode individual" (1 participant per "equip",
 * amb el nom del participant a la UI en lloc del nom d'equip).
 */
export const INDIVIDUAL_MODE_FORMATS: ReadonlyArray<EventFormat> = [
  "league_only",
  "group_stage_bracket",
];

export function supportsIndividualMode(format: EventFormat): boolean {
  return INDIVIDUAL_MODE_FORMATS.includes(format);
}

export function isIndividualMode(
  format: EventFormat,
  config: EventFormatConfig | undefined
): boolean {
  return supportsIndividualMode(format) && Boolean(config?.individualMode);
}

/**
 * Etiqueta visible del format, tenint en compte el mode individual.
 * Per a esdeveniments en mode individual, afegim el sufix " (individual)".
 */
export function getEventFormatLabel(event: Pick<OlimpiadaEvent, "format" | "config">): string {
  const base = formatLabels[event.format];
  return isIndividualMode(event.format, event.config) ? `${base} (individual)` : base;
}
