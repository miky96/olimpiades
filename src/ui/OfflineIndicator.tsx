import { useOnlineStatus } from "@/lib/useOnlineStatus";

/**
 * Pill discret que apareix només quan el navegador està offline.
 * Mostra a l'usuari que els canvis es guardaran localment i es
 * sincronitzaran automàticament quan torni la connexió.
 *
 * El sync diferit el gestiona Firestore via `persistentLocalCache`;
 * aquest component només informa l'usuari.
 */
export function OfflineIndicator() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <span
      role="status"
      aria-live="polite"
      title="Sense connexió. Els canvis es guarden localment i es sincronitzaran quan tornis online."
      className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
      />
      Offline · es sincronitzarà
    </span>
  );
}
