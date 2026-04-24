interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Eyebrow opcional (petit text a sobre del títol). */
  eyebrow?: string;
}

export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200/70 pb-4 dark:border-slate-800/70">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-brand-700 dark:text-brand-400">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 text-balance sm:text-3xl dark:text-white">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex flex-shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
