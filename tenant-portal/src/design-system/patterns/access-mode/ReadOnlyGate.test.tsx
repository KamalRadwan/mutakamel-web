// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReadOnlyGate, type ReadOnlyGateLabels } from "./ReadOnlyGate";

afterEach(cleanup);

const labels: ReadOnlyGateLabels = {
  blockedTitle: "This workspace is blocked",
  blockedDescription: "The subscription no longer permits access. Contact the account owner.",
  readOnlyNotice: "Read-only: the subscription does not permit changes right now.",
  dunningNotice: "Payment overdue — changes are suspended until the invoice is settled.",
};

describe("ReadOnlyGate", () => {
  it("renders children untouched while the mode is unresolved, because a client check is advisory", () => {
    render(
      <ReadOnlyGate mode={null} labels={labels}>
        <p>Leads workspace</p>
      </ReadOnlyGate>,
    );
    expect(screen.getByText("Leads workspace")).toBeInTheDocument();
    expect(screen.queryByText(labels.readOnlyNotice)).toBeNull();
  });

  it("renders children with no notice on FULL", () => {
    render(
      <ReadOnlyGate mode="FULL" labels={labels}>
        <p>Leads workspace</p>
      </ReadOnlyGate>,
    );
    expect(screen.getByText("Leads workspace")).toBeInTheDocument();
    expect(screen.queryByText(labels.readOnlyNotice)).toBeNull();
  });

  it("keeps the content readable under READ_ONLY and explains why it is not writable", () => {
    render(
      <ReadOnlyGate mode="READ_ONLY" labels={labels}>
        <p>Leads workspace</p>
      </ReadOnlyGate>,
    );
    expect(screen.getByText("Leads workspace")).toBeInTheDocument();
    expect(screen.getByText(labels.readOnlyNotice)).toBeInTheDocument();
  });

  it("uses the dunning wording under DUNNING, which is a different cause from read-only", () => {
    render(
      <ReadOnlyGate mode="DUNNING" labels={labels}>
        <p>Leads workspace</p>
      </ReadOnlyGate>,
    );
    expect(screen.getByText(labels.dunningNotice)).toBeInTheDocument();
    expect(screen.queryByText(labels.readOnlyNotice)).toBeNull();
  });

  it("drops the dunning notice on a screen whose action the backend allows during dunning", () => {
    render(
      <ReadOnlyGate mode="DUNNING" allowedDuringDunning labels={labels}>
        <p>Pay the invoice</p>
      </ReadOnlyGate>,
    );
    expect(screen.getByText("Pay the invoice")).toBeInTheDocument();
    expect(screen.queryByText(labels.dunningNotice)).toBeNull();
  });

  it("replaces the body entirely on BLOCKED — the backend refuses reads too", () => {
    render(
      <ReadOnlyGate mode="BLOCKED" labels={labels}>
        <p>Leads workspace</p>
      </ReadOnlyGate>,
    );
    expect(screen.queryByText("Leads workspace")).toBeNull();
    expect(screen.getByText(labels.blockedTitle)).toBeInTheDocument();
    expect(screen.getByText(labels.blockedDescription)).toBeInTheDocument();
  });

  it("never re-opens READ_ONLY through the dunning exemption", () => {
    render(
      <ReadOnlyGate mode="READ_ONLY" allowedDuringDunning labels={labels}>
        <p>Leads workspace</p>
      </ReadOnlyGate>,
    );
    expect(screen.getByText(labels.readOnlyNotice)).toBeInTheDocument();
  });
});
