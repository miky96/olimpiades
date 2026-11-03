import { createContext } from "react";

/**
 * Tipus i context del sistema de diàlegs.
 * Es manté en un fitxer sense JSX perquè el provider i el hook el puguin
 * importar sense crear cicles, igual que es fa amb l'AuthContext.
 */

export type DialogTone = "default" | "danger";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
}

export interface AlertOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  tone?: DialogTone;
}

export interface PromptOptions {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
}

/** Una opció d'un diàleg de tria (`choose`). */
export interface ChooseOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  /** "primary" per destacar l'opció recomanada; per defecte "secondary". */
  variant?: "primary" | "secondary" | "danger";
}

export interface ChooseOptions<T extends string = string> {
  title: string;
  message?: string;
  options: ChooseOption<T>[];
  cancelLabel?: string;
}

export interface DialogApi {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /**
   * Diàleg amb N opcions. Resol amb el `value` de l'opció triada o `null`
   * si l'usuari cancel·la (botó, Esc o clic fora).
   */
  choose: <T extends string>(opts: ChooseOptions<T>) => Promise<T | null>;
  alert: (opts: AlertOptions) => Promise<void>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

export const DialogContext = createContext<DialogApi | null>(null);
