import type { EventFormat } from "./types";

export const formatLabels: Record<EventFormat, string> = {
  single_match: "Partit únic",
  bracket: "Eliminatòria (bracket)",
  group_stage_bracket: "Lligueta + eliminatòria",
};

export const formatDescriptions: Record<EventFormat, string> = {
  single_match: "Un sol partit entre dues persones o equips.",
  bracket: "Eliminatòria directa 1 vs 1 amb byes si cal.",
  group_stage_bracket:
    "Lligueta prèvia en grups de 3 o 4 + eliminatòria amb els classificats.",
};
