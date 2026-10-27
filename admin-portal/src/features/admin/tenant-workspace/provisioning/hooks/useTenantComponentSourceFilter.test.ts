// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readTenantComponentInstallation } from "../model/readers";
import { componentInstallation } from "../test/fixtures";
import { useTenantComponentSourceFilter } from "./useTenantComponentSourceFilter";

describe("tenant component source filter", () => {
  it("shows all loaded sources, filters add-ons, follows refreshed rows, and clears the filter", () => {
    const foundation = readTenantComponentInstallation(componentInstallation());
    const addon = readTenantComponentInstallation(componentInstallation({
      componentKey: "crm.addon",
      selectionSource: "ADDON",
    }));
    const { result, rerender } = renderHook(
      (items) => useTenantComponentSourceFilter(items),
      { initialProps: [foundation, addon] },
    );

    expect(result.current.components).toEqual([foundation, addon]);
    act(() => result.current.setSelectionSource("ADDON"));
    expect(result.current.selectionSource).toBe("ADDON");
    expect(result.current.components).toEqual([addon]);

    rerender([foundation]);
    expect(result.current.components).toEqual([]);
    act(() => result.current.setSelectionSource("ALL"));
    expect(result.current.components).toEqual([foundation]);
  });
});
