import { useContext } from "react";
import { DialogContext, type DialogApi } from "./dialog-context";

/**
 * Hook per accedir a `confirm`, `alert` i `prompt` integrats amb l'estil de l'app.
 * Llança un error si s'utilitza fora de `DialogProvider` per evitar regressions
 * silencioses (ex: fall back a window.confirm sense que l'admin se n'adoni).
 */
export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error(
      "useDialog s'ha d'utilitzar dins de <DialogProvider /> (revisa main.tsx)."
    );
  }
  return ctx;
}
