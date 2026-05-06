import type { EventFormat } from "./types";

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
