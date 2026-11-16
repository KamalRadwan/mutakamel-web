// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmActionModal } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import {
  useUnsavedChangesGuard,
  type UnsavedChangesGuard,
} from "./useUnsavedChangesGuard";

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

function dispatchAnchorClick(
  anchor: HTMLAnchorElement,
  init: MouseEventInit = {},
  clickTarget: Element = anchor,
): { preventedByGuard: boolean } {
  let preventedByGuard = false;
  // Observe defaultPrevented at the end of bubble phase (after document capture
  // and React handlers), then suppress jsdom's unimplemented navigation step.
  window.addEventListener(
    "click",
    (event) => {
      preventedByGuard = event.defaultPrevented;
      event.preventDefault();
    },
    { once: true },
  );
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...init,
  });
  clickTarget.dispatchEvent(event);
  return { preventedByGuard };
}

function dispatchBeforeUnload(): Event {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  routerMock.push.mockReset();
  window.history.replaceState(null, "", "/core/settings/workspace");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("useUnsavedChangesGuard", () => {
  it("cancels native same-document Back/Forward, preserves edits on cancel, and resumes the same entry only after confirmation", () => {
    const traversal = { committed: Promise.resolve(), finished: Promise.resolve() };
    const navigation = Object.assign(new EventTarget(), { traverseTo: vi.fn(() => traversal) });
    vi.stubGlobal("navigation", navigation);
    const { result, unmount } = renderHook(() => useUnsavedChangesGuard(true));
    const traverse = (cancelable = true, sameDocument = true) => {
      const event = Object.assign(new Event("navigate", { cancelable }), {
        navigationType: "traverse", hashChange: false,
        destination: { key: "currency-entry", sameDocument, url: `${window.location.origin}/core/settings/currencies` },
      });
      act(() => { navigation.dispatchEvent(event); });
      return event;
    };
    expect(traverse().defaultPrevented).toBe(true);
    expect(result.current.isDiscardOpen).toBe(true);
    act(() => result.current.cancelDiscard());
    expect(navigation.traverseTo).not.toHaveBeenCalled();
    expect(traverse().defaultPrevented).toBe(true);
    act(() => result.current.confirmDiscard());
    expect(navigation.traverseTo).toHaveBeenCalledExactlyOnceWith("currency-entry");
    expect(traverse().defaultPrevented).toBe(false);
    expect(result.current.isDiscardOpen).toBe(false);
    expect(traverse(false).defaultPrevented).toBe(false);
    expect(traverse(true, false).defaultPrevented).toBe(false);
    unmount();
    expect(traverse().defaultPrevented).toBe(false);
  });

  it("executes requestDiscard immediately when clean without opening confirmation", () => {
    const action = vi.fn();
    const { result } = renderHook(
      ({ isDirty }): UnsavedChangesGuard => useUnsavedChangesGuard(isDirty),
      { initialProps: { isDirty: false } },
    );

    expect(result.current.isDiscardOpen).toBe(false);
    act(() => {
      result.current.requestDiscard(action);
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.isDiscardOpen).toBe(false);
  });

  it("retains a dirty action until confirmed once, and preserves edits when cancelled", () => {
    const firstAction = vi.fn();
    const secondAction = vi.fn();
    const { result, rerender } = renderHook(({ isDirty }) => useUnsavedChangesGuard(isDirty), {
      initialProps: { isDirty: true },
    });

    act(() => {
      result.current.requestDiscard(firstAction);
    });
    expect(result.current.isDiscardOpen).toBe(true);
    expect(firstAction).not.toHaveBeenCalled();

    act(() => {
      result.current.cancelDiscard();
    });
    expect(result.current.isDiscardOpen).toBe(false);
    expect(firstAction).not.toHaveBeenCalled();

    act(() => {
      result.current.confirmDiscard();
    });
    expect(firstAction).not.toHaveBeenCalled();

    act(() => {
      result.current.requestDiscard(firstAction);
      result.current.requestDiscard(secondAction);
    });
    act(() => {
      result.current.confirmDiscard();
      result.current.confirmDiscard();
    });
    expect(firstAction).not.toHaveBeenCalled();
    expect(secondAction).toHaveBeenCalledTimes(1);
    expect(result.current.isDiscardOpen).toBe(false);

    act(() => {
      result.current.requestDiscard(firstAction);
    });
    expect(result.current.isDiscardOpen).toBe(true);
    rerender({ isDirty: false });
    expect(result.current.isDiscardOpen).toBe(false);
    act(() => {
      result.current.confirmDiscard();
    });
    expect(firstAction).not.toHaveBeenCalled();
  });

  it("registers beforeunload only while dirty and removes it when clean or unmounted", () => {
    const { rerender, unmount } = renderHook(({ isDirty }) => useUnsavedChangesGuard(isDirty), {
      initialProps: { isDirty: false },
    });

    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);

    rerender({ isDirty: true });
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true);

    rerender({ isDirty: false });
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);

    rerender({ isDirty: true });
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true);

    unmount();
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
  });

  it("guards ordinary same-origin anchor clicks while dirty and navigates on confirm", () => {
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "/core/settings/taxes?status=ACTIVE#list");
    const nestedLabel = document.createElement("span");
    nestedLabel.textContent = "Taxes";
    anchor.appendChild(nestedLabel);
    document.body.appendChild(anchor);

    const { result } = renderHook(() => useUnsavedChangesGuard(true));

    let clickResult!: { preventedByGuard: boolean };
    act(() => {
      clickResult = dispatchAnchorClick(anchor, {}, nestedLabel);
    });
    expect(clickResult.preventedByGuard).toBe(true);
    expect(result.current.isDiscardOpen).toBe(true);
    expect(routerMock.push).not.toHaveBeenCalled();

    act(() => {
      result.current.cancelDiscard();
    });
    expect(routerMock.push).not.toHaveBeenCalled();

    act(() => {
      clickResult = dispatchAnchorClick(anchor, {}, nestedLabel);
    });
    expect(clickResult.preventedByGuard).toBe(true);
    act(() => {
      result.current.confirmDiscard();
    });
    expect(routerMock.push).toHaveBeenCalledTimes(1);
    expect(routerMock.push).toHaveBeenCalledWith("/core/settings/taxes?status=ACTIVE#list");
  });

  it("preserves modifier, middle-click, new-tab, download, same-page hash, external, and clean clicks", () => {
    const { result, rerender, unmount } = renderHook(
      ({ isDirty }) => useUnsavedChangesGuard(isDirty),
      { initialProps: { isDirty: true } },
    );

    const makeAnchor = (href: string, attrs: Record<string, string> = {}) => {
      const anchor = document.createElement("a");
      anchor.setAttribute("href", href);
      for (const [key, value] of Object.entries(attrs)) {
        anchor.setAttribute(key, value);
      }
      document.body.appendChild(anchor);
      return anchor;
    };

    const routeLink = makeAnchor("/core/settings/email");
    for (const modifier of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
    ]) {
      expect(dispatchAnchorClick(routeLink, modifier).preventedByGuard).toBe(false);
      expect(result.current.isDiscardOpen).toBe(false);
    }

    const newTabLink = makeAnchor("/core/settings/email", { target: "_blank" });
    expect(dispatchAnchorClick(newTabLink).preventedByGuard).toBe(false);

    const downloadLink = makeAnchor("/core/settings/export.csv", { download: "" });
    expect(dispatchAnchorClick(downloadLink).preventedByGuard).toBe(false);

    const bareHashLink = makeAnchor("#dns");
    expect(dispatchAnchorClick(bareHashLink).preventedByGuard).toBe(false);

    const samePathHashLink = makeAnchor("/core/settings/workspace#dns");
    expect(dispatchAnchorClick(samePathHashLink).preventedByGuard).toBe(false);

    const selfLink = makeAnchor("/core/settings/workspace");
    expect(dispatchAnchorClick(selfLink).preventedByGuard).toBe(false);

    const externalLink = makeAnchor("https://docs.example.com/guide");
    expect(dispatchAnchorClick(externalLink).preventedByGuard).toBe(false);

    const mailtoLink = makeAnchor("mailto:support@example.com");
    expect(dispatchAnchorClick(mailtoLink).preventedByGuard).toBe(false);

    expect(result.current.isDiscardOpen).toBe(false);
    expect(routerMock.push).not.toHaveBeenCalled();

    rerender({ isDirty: false });
    expect(dispatchAnchorClick(routeLink).preventedByGuard).toBe(false);

    rerender({ isDirty: true });
    unmount();
    expect(dispatchAnchorClick(routeLink).preventedByGuard).toBe(false);
  });

  it.each([en, ar])("wires cleanly into ConfirmActionModal for cancel and confirm", (t) => {
    const onDiscard = vi.fn();

    function Harness() {
      const guard = useUnsavedChangesGuard(true);
      return (
        <div>
          <button type="button" onClick={() => guard.requestDiscard(onDiscard)}>
            Reset
          </button>
          <ConfirmActionModal
            open={guard.isDiscardOpen}
            onOpenChange={(open) => {
              if (!open) guard.cancelDiscard();
            }}
            title={t.common.discardTitle}
            description={t.common.discardDescription}
            confirmLabel={t.common.discardConfirm}
            cancelLabel={t.common.cancel}
            onConfirm={guard.confirmDiscard}
          />
        </div>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("alertdialog", { name: t.common.discardTitle })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onDiscard).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: t.common.discardConfirm }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    cleanup();
  });
});
