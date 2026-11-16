// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { useInventoryNodesView } from "./useInventoryNodesView";

const state = vi.hoisted(() => ({ pathname: "/trade/inventory/nodes" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.body.replaceChildren(); });
const id = "01902001-3000-7000-8000-000000000001";
it("preserves loaded filters/view across native-history dossiers and restores trigger or heading focus", () => {
  state.pathname = TENANT_ROUTES.tradeInventoryNodes;
  window.history.replaceState(null, "", state.pathname);
  const push = vi.spyOn(window.history, "pushState");
  const replace = vi.spyOn(window.history, "replaceState");
  const scope = {};
  const { result, rerender } = renderHook(() => useInventoryNodesView([], scope));
  act(() => { result.current.setSearch("Cairo"); result.current.setView("cards"); });
  const trigger = document.createElement("button"); document.body.append(trigger); trigger.focus();
  act(() => result.current.openNode(id));
  expect(push).toHaveBeenCalledWith(null, "", `${state.pathname}/${id}`);
  state.pathname = `${TENANT_ROUTES.tradeInventoryNodes}/${id}`; rerender();
  expect(result.current.detailId).toBe(id);
  expect(result.current.search).toBe("Cairo"); expect(result.current.view).toBe("cards");
  act(() => result.current.closeNode());
  expect(replace).toHaveBeenCalledWith(null, "", TENANT_ROUTES.tradeInventoryNodes);
  document.body.focus(); const event = new Event("close", { cancelable: true });
  result.current.restoreFocus(event); expect(event.defaultPrevented).toBe(true); expect(trigger).toHaveFocus();
  const heading = document.createElement("h1"); heading.tabIndex = -1; document.body.append(heading);
  act(() => { result.current.headingRef.current = heading; }); trigger.remove();
  result.current.restoreFocus(new Event("close", { cancelable: true })); expect(heading).toHaveFocus();
});

it("opens a directly loaded detail path and drops scoped filters after an identity change", () => {
  state.pathname = `${TENANT_ROUTES.tradeInventoryNodes}/${id}`;
  let scope = {};
  const { result, rerender } = renderHook(() => useInventoryNodesView([], scope));
  expect(result.current.detailId).toBe(id);
  act(() => result.current.setStatus("ACTIVE"));
  scope = {}; rerender(); expect(result.current.status).toBe("ALL");
});
