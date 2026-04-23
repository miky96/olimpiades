import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { seasonsRepo } from "@/data";
import type { Season } from "@/domain/types";
import { SeasonContext, type SeasonState } from "./season-context";

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await seasonsRepo.list();
      list.sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
      setSeasons(list);
      // Si encara no hi ha cap temporada seleccionada, agafem l'activa.
      const active = list.find((s) => s.status === "active");
      setCurrentId((prev) => prev ?? active?.id ?? list[0]?.id ?? null);
    } catch (e) {
      console.error(e);
      setError("No s'han pogut carregar les temporades.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<SeasonState>(
    () => ({
      seasons,
      currentSeason: seasons.find((s) => s.id === currentId) ?? null,
      loading,
      error,
      selectSeason(seasonId: string) {
        setCurrentId(seasonId);
      },
      refresh,
    }),
    [seasons, currentId, loading, error, refresh]
  );

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}
