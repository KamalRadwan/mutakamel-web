import { cn } from "../../lib/cn";

/**
 * SecondNavBar / PageHeader —
 * Renders the top secondary navigation bar across main pages, hosting
 * the page title and status indicators on the start side, and action controllers
 * (e.g. Register New Tenant button, lifecycle actions) on the end side.
 * Seamlessly spans full width flush below the Topbar with compact height and clean borders.
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
    <div
      className={cn(
        "-mx-3 -mt-3 md:-mx-[15px] md:-mt-[15px] mb-3 min-h-11 border-b border-border bg-card px-3 py-2 md:px-[15px] flex flex-wrap items-center justify-between gap-2.5 shadow-xs",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2.5">
        {breadcrumb}
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
            {title}
          </h1>
          {status}
        </div>
        {description && (
          <p className="truncate text-xs text-muted-foreground sm:ms-1">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export const SecondNavBar = PageHeader;
