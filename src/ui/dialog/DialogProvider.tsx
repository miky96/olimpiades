import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button, Field, Input } from "@/ui/forms";
import {
  DialogContext,
  type AlertOptions,
  type ChooseOption,
  type ChooseOptions,
  type ConfirmOptions,
  type DialogApi,
  type DialogTone,
  type PromptOptions,
} from "./dialog-context";

/**
 * Provider que substitueix els `window.alert/confirm/prompt` natius del navegador
 * per diàlegs amb l'estil de l'app. Manté una sola entrada activa a la vegada
 * (cua FIFO si arriben crides simultànies) i resol amb el resultat de l'usuari.
 */

type DialogKind = "alert" | "confirm" | "prompt" | "choose";

interface BaseDialogState {
  id: number;
  kind: DialogKind;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone: DialogTone;
}

interface ConfirmDialogState extends BaseDialogState {
  kind: "confirm";
  resolve: (value: boolean) => void;
}

interface AlertDialogState extends BaseDialogState {
  kind: "alert";
  resolve: (value: void) => void;
}

interface PromptDialogState extends BaseDialogState {
  kind: "prompt";
  label?: string;
  placeholder?: string;
  defaultValue: string;
  required: boolean;
  resolve: (value: string | null) => void;
}

interface ChooseDialogState extends BaseDialogState {
  kind: "choose";
  options: ChooseOption[];
  resolve: (value: string | null) => void;
}

type DialogState =
  | ConfirmDialogState
  | AlertDialogState
  | PromptDialogState
  | ChooseDialogState;

let dialogIdCounter = 0;

export function DialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<DialogState[]>([]);
  const current = queue[0] ?? null;

  const enqueue = useCallback((dialog: DialogState) => {
    setQueue((prev) => [...prev, dialog]);
  }, []);

  const closeCurrent = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  const api = useMemo<DialogApi>(() => {
    const confirm = (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        enqueue({
          id: ++dialogIdCounter,
          kind: "confirm",
          title: opts.title,
          message: opts.message,
          confirmLabel: opts.confirmLabel ?? "Confirmar",
          cancelLabel: opts.cancelLabel ?? "Cancel·lar",
          tone: opts.tone ?? "default",
          resolve,
        });
      });

    const alert = (opts: AlertOptions) =>
      new Promise<void>((resolve) => {
        enqueue({
          id: ++dialogIdCounter,
          kind: "alert",
          title: opts.title,
          message: opts.message,
          confirmLabel: opts.confirmLabel ?? "D'acord",
          tone: opts.tone ?? "default",
          resolve,
        });
      });

    const prompt = (opts: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        enqueue({
          id: ++dialogIdCounter,
          kind: "prompt",
          title: opts.title,
          message: opts.message,
          label: opts.label,
          placeholder: opts.placeholder,
          defaultValue: opts.defaultValue ?? "",
          required: opts.required ?? false,
          confirmLabel: opts.confirmLabel ?? "Desar",
          cancelLabel: opts.cancelLabel ?? "Cancel·lar",
          tone: "default",
          resolve,
        });
      });

    const choose = <T extends string>(opts: ChooseOptions<T>) =>
      new Promise<T | null>((resolve) => {
        enqueue({
          id: ++dialogIdCounter,
          kind: "choose",
          title: opts.title,
          message: opts.message,
          options: opts.options,
          confirmLabel: "",
          cancelLabel: opts.cancelLabel ?? "Cancel·lar",
          tone: "default",
          resolve: (value) => resolve(value as T | null),
        });
      });

    return { confirm, alert, prompt, choose };
  }, [enqueue]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {current ? (
        <DialogModal key={current.id} dialog={current} onClose={closeCurrent} />
      ) : null}
    </DialogContext.Provider>
  );
}

function DialogModal({
  dialog,
  onClose,
}: {
  dialog: DialogState;
  onClose: () => void;
}) {
  const [value, setValue] = useState(
    dialog.kind === "prompt" ? dialog.defaultValue : ""
  );
  const inputRef = useRef<HTMLInputElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  // Tanca amb Esc i evita scroll del body mentre està obert.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      handleCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus inicial: input al prompt, botó de confirmar a la resta.
  useEffect(() => {
    if (dialog.kind === "prompt") {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (dialog.kind === "choose") {
      // Sense focus automàtic: evitem que un Enter accidental triï una opció.
    } else {
      confirmButtonRef.current?.focus();
    }
  }, [dialog.kind]);

  function handleCancel() {
    if (dialog.kind === "alert") {
      dialog.resolve();
    } else if (dialog.kind === "confirm") {
      dialog.resolve(false);
    } else {
      dialog.resolve(null);
    }
    onClose();
  }

  function handleChoose(value: string) {
    if (dialog.kind !== "choose") return;
    dialog.resolve(value);
    onClose();
  }

  function handleConfirm() {
    if (dialog.kind === "alert") {
      dialog.resolve();
    } else if (dialog.kind === "confirm") {
      dialog.resolve(true);
    } else if (dialog.kind === "choose") {
      return;
    } else {
      const trimmed = value;
      if (dialog.required && trimmed.trim().length === 0) {
        // No tanquem si és obligatori i està buit.
        inputRef.current?.focus();
        return;
      }
      dialog.resolve(trimmed);
    }
    onClose();
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    handleConfirm();
  }

  const confirmVariant: "primary" | "danger" =
    dialog.tone === "danger" ? "danger" : "primary";

  const showCancel = dialog.kind !== "alert";

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        // Tanca només si es clica fora del panell (no en arrossegar text dins).
        if (e.target === e.currentTarget) handleCancel();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm dark:bg-slate-950/60"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`dialog-title-${dialog.id}`}
        className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl outline-none dark:border-slate-800/80 dark:bg-slate-900 sm:p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id={`dialog-title-${dialog.id}`}
          className="text-base font-semibold text-slate-900 dark:text-white"
        >
          {dialog.title}
        </h2>
        {dialog.message ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {dialog.message}
          </p>
        ) : null}

        {dialog.kind === "choose" ? (
          <div className="mt-5 space-y-2">
            {dialog.options.map((opt) => (
              <ChooseOptionButton
                key={opt.value}
                option={opt}
                onClick={() => handleChoose(opt.value)}
              />
            ))}
            <div className="flex justify-end pt-1">
              <Button variant="ghost" size="md" onClick={handleCancel}>
                {dialog.cancelLabel ?? "Cancel·lar"}
              </Button>
            </div>
          </div>
        ) : dialog.kind === "prompt" ? (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <Field label={dialog.label ?? "Valor"}>
              <Input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={dialog.placeholder}
                required={dialog.required}
                autoComplete="off"
              />
            </Field>
            <DialogActions
              showCancel
              cancelLabel={dialog.cancelLabel ?? "Cancel·lar"}
              confirmLabel={dialog.confirmLabel}
              confirmVariant={confirmVariant}
              confirmRef={confirmButtonRef}
              onCancel={handleCancel}
              confirmType="submit"
            />
          </form>
        ) : (
          <div className="mt-5">
            <DialogActions
              showCancel={showCancel}
              cancelLabel={dialog.cancelLabel ?? "Cancel·lar"}
              confirmLabel={dialog.confirmLabel}
              confirmVariant={confirmVariant}
              confirmRef={confirmButtonRef}
              onCancel={handleCancel}
              onConfirm={handleConfirm}
              confirmType="button"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ChooseOptionButton({
  option,
  onClick,
}: {
  option: ChooseOption;
  onClick: () => void;
}) {
  const tone =
    option.variant === "primary"
      ? "border-brand-500 bg-brand-50/70 hover:bg-brand-100/70 dark:border-brand-500/60 dark:bg-brand-500/10 dark:hover:bg-brand-500/20"
      : option.variant === "danger"
      ? "border-rose-300 hover:bg-rose-50 dark:border-rose-500/40 dark:hover:bg-rose-500/10"
      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded-xl border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${tone}`}
    >
      <span className="block text-sm font-semibold text-slate-900 dark:text-white">
        {option.label}
      </span>
      {option.description ? (
        <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">
          {option.description}
        </span>
      ) : null}
    </button>
  );
}

function DialogActions({
  showCancel,
  cancelLabel,
  confirmLabel,
  confirmVariant,
  confirmRef,
  onCancel,
  onConfirm,
  confirmType,
}: {
  showCancel: boolean;
  cancelLabel: string;
  confirmLabel: string;
  confirmVariant: "primary" | "danger";
  confirmRef: React.RefObject<HTMLButtonElement>;
  onCancel: () => void;
  onConfirm?: () => void;
  confirmType: "submit" | "button";
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {showCancel ? (
        <Button variant="secondary" size="md" onClick={onCancel}>
          {cancelLabel}
        </Button>
      ) : null}
      <Button
        ref={confirmRef}
        variant={confirmVariant}
        size="md"
        type={confirmType}
        onClick={confirmType === "button" ? onConfirm : undefined}
      >
        {confirmLabel}
      </Button>
    </div>
  );
}
