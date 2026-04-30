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

export interface DialogApi {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  alert: (opts: AlertOptions) => Promise<void>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

export const DialogContext = createContext<DialogApi | null>(null);
