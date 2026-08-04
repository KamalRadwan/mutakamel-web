import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

interface BackupPageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export function BackupPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: BackupPageHeaderProps) {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:px-7">
      <div
        className="pointer-events-none absolute inset-y-0 end-0 w-1/3 bg-[radial-gradient(circle_at_center,rgba(14,116,144,0.12),transparent_68%)]"
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
            <span className="grid size-8 place-items-center rounded-xl bg-cyan-50 dark:bg-cyan-950/50">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            {eyebrow}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            {description}
          </p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}

