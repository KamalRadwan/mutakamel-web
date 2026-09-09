import { cn } from "../../lib/cn";

/**
 * Title / description / breadcrumb / the single primary action / status —
 * replaces ~50 ad-hoc page headers. Only one variant="primary" Button
 * should ever be passed as `action` (docs/design-system/geometry-and-
 * density.md's one-primary-fill-per-page rule); this component doesn't
 * enforce that, it just gives the action a single, consistent slot.
 */
export function PageHeader({
  title,
  description,
  breadcrumb,
  action,
  status,
  className,
}: {
  title: string;
  description?: string;
  breadcrumb?: React.ReactNode;
  action?: React.ReactNode;
  status?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 pb-4", className)}>
      {breadcrumb}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            {status}
          </div>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="flex max-w-full shrink-0 items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}
