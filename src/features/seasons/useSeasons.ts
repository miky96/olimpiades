import { useContext } from "react";
import { SeasonContext, type SeasonState } from "./season-context";

export function useSeasons(): SeasonState {
  const ctx = useContext(SeasonContext);
  if (!ctx) {
    throw new Error("useSeasons s'ha de cridar dins d'un <SeasonProvider>");
  }
  return ctx;
}
