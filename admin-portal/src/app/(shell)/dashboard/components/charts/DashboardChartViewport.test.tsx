// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  billingChartGroupReservation,
  DashboardChartViewport,
  operationalChartGroupReservation,
} from "./DashboardChartViewport";

const i18nState = vi.hoisted(() => ({ lang: "en" as "ar" | "en" }));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: i18nState.lang }),
}));

let observers: TestIntersectionObserver[] = [];

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds = [0];
  private readonly callback: IntersectionObserverCallback;
  private target: Element | null = null;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.rootMargin = options?.rootMargin ?? "0px";
    observers.push(this);
  }

  observe(target: Element) {
    this.target = target;
  }

  unobserve() {
    this.target = null;
  }

  disconnect() {
    this.target = null;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  emit(isIntersecting: boolean) {
    if (!this.target) throw new Error("Observer target is not connected");
    this.callback(
      [
        {
          boundingClientRect: this.target.getBoundingClientRect(),
          intersectionRatio: isIntersecting ? 1 : 0,
          intersectionRect: this.target.getBoundingClientRect(),
          isIntersecting,
          rootBounds: null,
          target: this.target,
          time: 0,
        },
      ],
      this,
    );
  }
}

describe("DashboardChartViewport", () => {
  beforeEach(() => {
    observers = [];
    i18nState.lang = "en";
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("reserves responsive space and defers its child until the group nears the viewport", () => {
    const reservation = operationalChartGroupReservation({
      tenantStatusCount: 2,
      domainTotal: 10,
      regionCount: 3,
      serverCount: 4,
    });
    render(
      <DashboardChartViewport kind="operations" reservation={reservation}>
        <p>Loaded operational charts</p>
      </DashboardChartViewport>,
    );

    const region = screen.getByRole("region", { name: "Operational dashboard charts" });
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region.style.getPropertyValue("--dashboard-chart-group-narrow")).toBe(`${reservation.narrow}px`);
    expect(region.style.getPropertyValue("--dashboard-chart-group-wide")).toBe(`${reservation.wide}px`);
    expect(screen.getByRole("status")).toHaveTextContent("Loading operational dashboard charts…");
    expect(screen.queryByText("Loaded operational charts")).not.toBeInTheDocument();
    expect(observers).toHaveLength(1);
    expect(observers[0].rootMargin).toBe("320px 0px");

    act(() => observers[0].emit(true));

    expect(screen.getByText("Loaded operational charts")).toBeInTheDocument();
    expect(region).not.toHaveAttribute("aria-busy");
  });

  it("uses a localized named loading state", () => {
    i18nState.lang = "ar";
    render(
      <DashboardChartViewport
        kind="billing"
        reservation={billingChartGroupReservation({ subscriptionCount: 1, planCount: 1 })}
      >
        <p>Loaded billing charts</p>
      </DashboardChartViewport>,
    );

    expect(
      screen.getByRole("region", { name: "الرسوم البيانية للفوترة في لوحة التحكم" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      "جارٍ تحميل الرسوم البيانية للفوترة في لوحة التحكم…",
    );
  });

  it("falls back to rendering without leaving content blocked when IntersectionObserver is unavailable", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(
      <DashboardChartViewport
        kind="billing"
        reservation={billingChartGroupReservation({ subscriptionCount: 0, planCount: 0 })}
      >
        <p>Loaded without observer</p>
      </DashboardChartViewport>,
    );

    await waitFor(() => expect(screen.getByText("Loaded without observer")).toBeInTheDocument());
  });

  it("force-renders its child without waiting for intersection", () => {
    render(
      <DashboardChartViewport
        kind="operations"
        reservation={operationalChartGroupReservation({
          tenantStatusCount: 1,
          domainTotal: 1,
          regionCount: 1,
          serverCount: 1,
        })}
        forceRender
      >
        <p>Forced operational charts</p>
      </DashboardChartViewport>,
    );

    expect(screen.getByText("Forced operational charts")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(observers).toHaveLength(0);
  });

  it("increases its deterministic reservation for taller region and server charts", () => {
    const compact = operationalChartGroupReservation({
      tenantStatusCount: 1,
      domainTotal: 1,
      regionCount: 1,
      serverCount: 1,
    });
    const tall = operationalChartGroupReservation({
      tenantStatusCount: 1,
      domainTotal: 1,
      regionCount: 12,
      serverCount: 12,
    });

    expect(tall.wide).toBeGreaterThan(compact.wide);
    expect(tall.narrow).toBeGreaterThan(compact.narrow);
    expect(tall.narrow).toBe(tall.cards.reduce((total, value) => total + value, 32));
  });

  it("caps reservations for arbitrarily large region and server collections", () => {
    const bounded = operationalChartGroupReservation({
      tenantStatusCount: 1,
      domainTotal: 1,
      regionCount: 12,
      serverCount: 12,
    });
    const huge = operationalChartGroupReservation({
      tenantStatusCount: 1,
      domainTotal: 1,
      regionCount: 10_000,
      serverCount: 10_000,
    });

    expect(huge).toEqual(bounded);
  });
});
