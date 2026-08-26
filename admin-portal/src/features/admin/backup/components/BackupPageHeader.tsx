import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/design-system";

interface BackupPageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export function BackupPageHeader({ eyebrow, title, description, actions }: BackupPageHeaderProps) {
  return (
    <PageHeader
      breadcrumb={
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">
          <span className="grid size-6 place-items-center rounded-md bg-brand-500/10">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
          </span>
          {eyebrow}
        </div>
      }
      title={title}
      description={description}
      action={actions}
    />
  );
}
