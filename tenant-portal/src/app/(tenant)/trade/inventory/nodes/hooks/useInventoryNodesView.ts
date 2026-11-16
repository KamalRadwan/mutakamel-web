"use client";
import { useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { isUuidV7 } from "../../../trade-advanced-validation";
import type { InventoryNode } from "../../inventory-contract";

export function useInventoryNodesView(items: InventoryNode[], scopeIdentity: object) {
  const pathname = usePathname();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const detailId = pathname.startsWith(`${TENANT_ROUTES.tradeInventoryNodes}/`) ? pathname.slice(TENANT_ROUTES.tradeInventoryNodes.length + 1) : undefined;
  const [filters, setFilters] = useState({ scopeIdentity, search: "", type: "ALL", status: "ALL" });
  const active = filters.scopeIdentity === scopeIdentity ? filters : { scopeIdentity, search: "", type: "ALL", status: "ALL" };
  const { search, type, status } = active;
  const patch = (values: Partial<Pick<typeof filters, "search" | "type" | "status">>) => setFilters({ ...active, ...values });
  const [view, setView] = useState<"table" | "cards">("table");
  const filtered = useMemo(() => items.filter((node) =>
    (type === "ALL" || node.nodeType === type) && (status === "ALL" || node.status === status) &&
    `${node.name} ${node.code} ${node.timezone}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  ), [items, search, type, status]);
  const openNode = (id: string) => {
    if (!isUuidV7(id)) return;
    const target = `${TENANT_ROUTES.tradeInventoryNodes}/${encodeURIComponent(id)}`;
    if (window.location.pathname === target) return;
    const focused = document.activeElement;
    returnFocus.current = focused instanceof HTMLElement && focused !== document.body && focused !== document.documentElement ? focused : null;
    window.history.pushState(null, "", target);
  };
  const closeNode = () => window.history.replaceState(null, "", TENANT_ROUTES.tradeInventoryNodes);
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    (returnFocus.current?.isConnected ? returnFocus.current : headingRef.current)?.focus({ preventScroll: true });
  };
  return { search, setSearch: (value: string) => patch({ search: value }), type, setType: (value: string) => patch({ type: value }), status,
    setStatus: (value: string) => patch({ status: value }), view, setView, filtered, detailId, openNode, closeNode, headingRef, restoreFocus };
}
