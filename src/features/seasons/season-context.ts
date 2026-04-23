import { createContext } from "react";
import type { Season } from "@/domain/types";

/**
 * Estat exposat pel SeasonProvider. Separat del fitxer del Provider per
 * mantenir Fast Refresh net (només-components per fitxer de component).
 */
export interface SeasonState {
  /** Totes les temporades conegudes (actives + arxivades). */
  seasons: Season[];
  /** Temporada actualment seleccionada per navegar (per defecte l'activa). */
  currentSeason: Season | null;
  /** True mentre s'està carregant la primera llista. */
  loading: boolean;
  /** Error en la càrrega inicial. */
  error: string | null;
  /** Selecciona una temporada per navegar (històrica o activa). */
  selectSeason(seasonId: string): void;
  /** Recarrega la llista des de Firestore. */
  refresh(): Promise<void>;
}

export const SeasonContext = createContext<SeasonState | undefined>(undefined);
