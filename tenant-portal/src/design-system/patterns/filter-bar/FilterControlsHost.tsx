import type { ReactNode } from "react";
import { PageActions } from "../../shell/PageActions";

export function FilterControlsHost({ placement, children }: {
  placement: "action-bar" | "inline";
  children: ReactNode;
}) {
  return placement === "inline"
    ? <div className="flex min-w-0 flex-wrap items-center gap-3">{children}</div>
    : <PageActions slot="search">{children}</PageActions>;
}
