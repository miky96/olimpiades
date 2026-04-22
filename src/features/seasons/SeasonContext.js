import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, } from "react";
import { seasonsRepo } from "@/data";
const SeasonContext = createContext(undefined);
export function SeasonProvider({ children }) {
    const [seasons, setSeasons] = useState([]);
    const [currentId, setCurrentId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
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
        }
        catch (e) {
            console.error(e);
            setError("No s'han pogut carregar les temporades.");
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void refresh();
    }, [refresh]);
    const value = useMemo(() => ({
        seasons,
        currentSeason: seasons.find((s) => s.id === currentId) ?? null,
        loading,
        error,
        selectSeason(seasonId) {
            setCurrentId(seasonId);
        },
        refresh,
    }), [seasons, currentId, loading, error, refresh]);
    return _jsx(SeasonContext.Provider, { value: value, children: children });
}
export function useSeasons() {
    const ctx = useContext(SeasonContext);
    if (!ctx) {
        throw new Error("useSeasons s'ha de cridar dins d'un <SeasonProvider>");
    }
    return ctx;
}
