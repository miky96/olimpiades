import { useEffect, useState } from "react";

/**
 * Retorna `true` si el navegador té connectivitat segons l'API
 * `navigator.onLine`. És una pista, no una garantia: el navegador només
 * sap si hi ha xarxa, no si Firestore és accessible. Tot i així, és
 * suficient per a un indicador UX.
 *
 * Quan tornem a estar online, Firestore replica automàticament les
 * escriptures que s'havien quedat a la queue local; no cal disparar
 * cap acció des d'aquí.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
