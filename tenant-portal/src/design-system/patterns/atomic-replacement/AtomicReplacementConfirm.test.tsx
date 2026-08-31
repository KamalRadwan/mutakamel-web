// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AtomicReplacementConfirm, type AtomicReplacementConfirmProps } from "./AtomicReplacementConfirm";
import { computeReplacementDiff, isEmptyDiff } from "./replacement-diff";

afterEach(cleanup);

const diff = computeReplacementDiff(
  [
    { id: "a", label: "Sales — Cairo", hint: "BRANCH" },
    { id: "b", label: "Finance — Tenant", hint: "TENANT" },
    { id: "c", label: "Support — Giza", hint: "BRANCH" },
  ],
  [
    { id: "a", label: "Sales — Cairo", hint: "BRANCH" },
    { id: "d", label: "Ops — Tenant", hint: "TENANT" },
  ],
);

function renderConfirm(overrides: Partial<AtomicReplacementConfirmProps> = {}) {
  const props: AtomicReplacementConfirmProps = {
    open: true,
    onOpenChange: vi.fn(),
    diff,
    onConfirm: vi.fn(),
    formatCount: (count) => String(count),
    labels: {
      title: "Replace scope-role assignments",
      description: "This replaces the whole set in one write.",
      addedHeading: "Adding {count}",
      removedHeading: "Removing {count}",
      unchangedHeading: "Unchanged ({count})",
      noChanges: "Nothing would change.",
      confirm: "Replace",
      cancel: "Cancel",
      acknowledge: "I understand {count} assignments will be removed",
    },
    ...overrides,
  };
  return { props, ...render(<AtomicReplacementConfirm {...props} />) };
}

describe("computeReplacementDiff", () => {
  it("splits a replacement into added, removed and unchanged", () => {
    expect(diff.added.map((item) => item.id)).toEqual(["d"]);
    expect(diff.removed.map((item) => item.id)).toEqual(["b", "c"]);
    expect(diff.unchanged.map((item) => item.id)).toEqual(["a"]);
  });

  it("takes a removed item's label from the SERVER copy, since it is absent from next", () => {
    expect(diff.removed.map((item) => item.label)).toEqual(["Finance — Tenant", "Support — Giza"]);
  });

  it("matches on id, never on label", () => {
    const renamed = computeReplacementDiff(
      [{ id: "a", label: "Old name" }],
      [{ id: "a", label: "New name" }],
    );
    expect(renamed.removed).toEqual([]);
    expect(renamed.unchanged.map((item) => item.id)).toEqual(["a"]);
  });

  it("reports an identical set as no change", () => {
    expect(isEmptyDiff(computeReplacementDiff([{ id: "a", label: "A" }], [{ id: "a", label: "A" }]))).toBe(true);
  });
});

describe("AtomicReplacementConfirm", () => {
  it("shows what is being REMOVED, which the PUT body never says", () => {
    renderConfirm();
    expect(screen.getByText("Removing 2")).toBeInTheDocument();
    expect(screen.getByText("Finance — Tenant")).toBeInTheDocument();
    expect(screen.getByText("Support — Giza")).toBeInTheDocument();
  });

  it("shows additions alongside removals", () => {
    renderConfirm();
    expect(screen.getByText("Adding 1")).toBeInTheDocument();
    expect(screen.getByText("Ops — Tenant")).toBeInTheDocument();
  });

  it("collapses the unchanged rows nobody needs to read", () => {
    renderConfirm();
    expect(screen.getByRole("button", { name: /Unchanged \(1\)/ })).toBeInTheDocument();
    expect(screen.queryByText("Sales — Cairo")).toBeNull();
  });

  it("gates confirm on an acknowledgement whenever anything is removed", () => {
    renderConfirm();
    const confirm = screen.getByRole("button", { name: "Replace" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirm).toBeEnabled();
  });

  it("takes the destructive variant when anything is removed", () => {
    renderConfirm();
    expect(screen.getByRole("button", { name: "Replace" }).className).toContain("bg-destructive");
  });

  it("needs no acknowledgement for an addition-only replacement", () => {
    renderConfirm({
      diff: computeReplacementDiff([{ id: "a", label: "A" }], [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ]),
    });
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Replace" })).toBeEnabled();
  });

  it("says so, and blocks the write, when nothing would change", () => {
    renderConfirm({
      diff: computeReplacementDiff([{ id: "a", label: "A" }], [{ id: "a", label: "A" }]),
    });
    expect(screen.getByText("Nothing would change.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace" })).toBeDisabled();
  });

  it("confirms once acknowledged", () => {
    const onConfirm = vi.fn();
    renderConfirm({ onConfirm });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
