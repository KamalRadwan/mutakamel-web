// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActivityList, type ActivityListProps } from "./ActivityList";

const activity = { id: "work-item", subject: "Prepare proposal", dueAt: "2026-10-07T10:00:00Z", version: 2 };
function renderList(overrides: Partial<ActivityListProps<typeof activity>> = {}) {
  const props: ActivityListProps<typeof activity> = {
    activities: [activity], isLoading: false, error: null, canEdit: true, canComplete: false,
    canDiscard: false, editingId: null, pendingId: null, onEdit: vi.fn(),
    onComplete: vi.fn(), onDiscard: vi.fn(),
    labels: { empty: "No open work", edit: "Edit", markDone: "Complete", discard: "Cancel" },
    describe: () => ({ type: "Task", priority: "High", priorityTone: "caution", due: "Tomorrow", actions: "Actions for proposal" }),
    ...overrides,
  };
  return { props, ...render(<ActivityList {...props} />) };
}
afterEach(cleanup);

describe("shared ActivityList template", () => {
  it("renders caller-provided labels without depending on lead-specific data", async () => {
    const { props } = renderList();
    expect(screen.getByRole("listitem")).toHaveTextContent("Prepare proposal");
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Tomorrow")).toHaveAttribute("datetime", activity.dueAt);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Actions for proposal" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    expect(props.onEdit).toHaveBeenCalledWith(activity);
    expect(screen.queryByRole("menuitem", { name: "Complete" })).toBeNull();
  });
  it("keeps loading, empty and failed reads distinct", () => {
    const { props, rerender } = renderList({ activities: [], isLoading: true });
    expect(screen.queryByText("No open work")).toBeNull();
    rerender(<ActivityList {...props} isLoading={false} error="Cannot read work" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Cannot read work");
    rerender(<ActivityList {...props} isLoading={false} />);
    expect(screen.getByText("No open work")).toBeInTheDocument();
  });
  it("hides unauthorized menus and disables actions during a write", () => {
    const { props, rerender } = renderList({ canEdit: false });
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<ActivityList {...props} canEdit pendingId={activity.id} />);
    expect(screen.getByRole("button", { name: "Actions for proposal" })).toBeDisabled();
  });
});
