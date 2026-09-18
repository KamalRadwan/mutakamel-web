// @vitest-environment jsdom

import { cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { OpportunityCardRecord } from "../hooks/pipeline-types";
import { useOpportunityCardSlots } from "./useOpportunityCardSlots";

const controls = vi.hoisted(() => ({ menu: vi.fn() }));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));
vi.mock("./opportunity-card/OpportunityCardMenu", () => ({
  OpportunityCardMenu: (props: Record<string, unknown>) => {
    controls.menu(props);
    return <div data-testid="opportunity-card-menu" />;
  },
}));

const item = {
  id: "0192f3a0-0000-7000-8000-000000000001",
  stageId: "0192f3a0-0000-7000-8000-000000000002",
  title: "Restricted deal",
  cardColor: "TEAL",
} as OpportunityCardRecord;

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("useOpportunityCardSlots menu permissions", () => {
  it("omits delete, colour and move actions when this row is not permitted", () => {
    const moveTargets = vi.fn(() => [{ id: "next-stage", label: "Next" }]);
    const { result } = renderHook(() =>
      useOpportunityCardSlots({
        canUpdate: () => false,
        canDelete: () => false,
        onOpen: vi.fn(),
        onDelete: vi.fn(),
        onCardChange: vi.fn(),
        onOpenActivities: vi.fn(),
        moveTargets,
        onMove: vi.fn(),
      }),
    );

    render(<>{result.current.renderActions(item)}</>);

    expect(controls.menu).toHaveBeenLastCalledWith(
      expect.objectContaining({
        onDelete: undefined,
        onColorChange: undefined,
        moveTargets: undefined,
        onMove: undefined,
      }),
    );
    expect(moveTargets).not.toHaveBeenCalled();
  });

  it("keeps row-authorized delete, colour and move actions available", () => {
    const moveTargets = vi.fn(() => [{ id: "next-stage", label: "Next" }]);
    const { result } = renderHook(() =>
      useOpportunityCardSlots({
        canUpdate: () => true,
        canDelete: () => true,
        onOpen: vi.fn(),
        onDelete: vi.fn(),
        onCardChange: vi.fn(),
        onOpenActivities: vi.fn(),
        moveTargets,
        onMove: vi.fn(),
      }),
    );

    render(<>{result.current.renderActions(item)}</>);

    expect(controls.menu).toHaveBeenLastCalledWith(
      expect.objectContaining({
        onDelete: expect.any(Function),
        onColorChange: expect.any(Function),
        moveTargets: [{ id: "next-stage", label: "Next" }],
        onMove: expect.any(Function),
      }),
    );
    expect(moveTargets).toHaveBeenCalledOnce();
  });
});
