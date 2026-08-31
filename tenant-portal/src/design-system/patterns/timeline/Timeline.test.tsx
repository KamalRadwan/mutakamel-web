// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Timeline, type TimelineEvent } from "./Timeline";

afterEach(cleanup);

const events: TimelineEvent[] = [
  { id: "3", title: "Stage moved to Qualified", timestamp: "2 hours ago", actor: "Kamal" },
  { id: "2", title: "Delivery attempt failed", timestamp: "Yesterday", tone: "negative" },
  { id: "1", title: "Lead created", timestamp: "Last week" },
];

describe("Timeline", () => {
  it("renders an ordered list named for what it is a history of", () => {
    render(<Timeline events={events} label="Audit history" />);
    const list = screen.getByRole("list", { name: "Audit history" });
    expect(list.tagName).toBe("OL");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("preserves the caller's order without sorting", () => {
    render(<Timeline events={events} label="Audit history" />);
    const titles = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(titles[0]).toContain("Stage moved to Qualified");
    expect(titles[2]).toContain("Lead created");
  });

  it("gives an OUTCOME a role colour and leaves an untoned event neutral", () => {
    const { container } = render(<Timeline events={events} label="Audit history" />);
    const markers = container.querySelectorAll("li > div > span:first-child");
    expect(markers[1].className).toContain("bg-destructive");
    // "Lead created" is a category, not an outcome — 1.44: a type never takes a hue.
    expect(markers[2].className).toContain("bg-muted");
  });

  it("encodes in-progress with the pending dot rather than a fifth hue", () => {
    const { container } = render(
      <Timeline events={[{ id: "1", title: "Sending", timestamp: "now", pending: true }]} label="Delivery" />,
    );
    const marker = container.querySelector("li > div > span:first-child")!;
    expect(marker.className).toContain("dot-pending");
    expect(marker.className).not.toContain("bg-brand");
  });

  it("renders the actor and any nested content", () => {
    render(
      <Timeline
        label="Audit history"
        events={[
          {
            id: "1",
            title: "Amount changed",
            timestamp: "now",
            actor: "Kamal",
            children: <p>1,000.00 → 1,250.00</p>,
          },
        ]}
      />,
    );
    expect(screen.getByText("Kamal")).toBeInTheDocument();
    expect(screen.getByText("1,000.00 → 1,250.00")).toBeInTheDocument();
  });

  it("renders the empty state rather than an empty rail", () => {
    render(<Timeline events={[]} label="Audit history" emptyTitle="No history yet" />);
    expect(screen.getByText("No history yet")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows skeletons while loading, not an empty state", () => {
    render(<Timeline events={[]} label="Audit history" emptyTitle="No history yet" isLoading />);
    expect(screen.queryByText("No history yet")).toBeNull();
  });

  it("pages a long history through an explicit control", () => {
    const onLoadMore = vi.fn();
    render(
      <Timeline events={events} label="Audit history" onLoadMore={onLoadMore} loadMoreLabel="Load more" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(onLoadMore).toHaveBeenCalled();
  });
});
