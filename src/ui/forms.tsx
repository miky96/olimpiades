import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
} from "react";

export function Field(
  props: LabelHTMLAttributes<HTMLLabelElement> & { label: string }
) {
  const { label, children, className = "", ...rest } = props;
  return (
    <label className={`block text-sm ${className}`} {...rest}>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`input ${className}`} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <select className={`input pr-8 ${className}`} {...rest}>
      {children}
    </select>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 focus-visible:ring-brand-500/40 disabled:bg-brand-300 dark:bg-brand-500 dark:hover:bg-brand-400 dark:disabled:bg-brand-500/40",
  secondary:
    "bg-white text-slate-800 border border-slate-300 shadow-sm hover:bg-slate-50 focus-visible:ring-slate-400/40 disabled:opacity-50 dark:bg-slate-800/60 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-800",
  danger:
    "bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:ring-rose-500/40 disabled:bg-rose-300 dark:bg-rose-500 dark:hover:bg-rose-400 dark:disabled:bg-rose-500/40",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400/40 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800/60",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
};

export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    className = "",
    type = "button",
    ...rest
  } = props;
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 focus:outline-none focus-visible:ring-4 disabled:cursor-not-allowed ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}

export function ErrorMessage({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
      {children}
    </p>
  );
}

type BadgeTone = "slate" | "brand" | "emerald" | "amber" | "rose";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const badgeTones: Record<BadgeTone, string> = {
  slate: "chip",
  brand: "chip-brand",
  emerald: "chip-emerald",
  amber: "chip-amber",
  rose: "chip-rose",
};

export function Badge({ tone = "slate", className = "", ...rest }: BadgeProps) {
  return <span className={`${badgeTones[tone]} ${className}`} {...rest} />;
}
