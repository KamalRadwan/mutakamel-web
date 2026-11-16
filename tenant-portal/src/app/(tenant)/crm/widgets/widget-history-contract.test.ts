import { describe, expect, it } from "vitest";
import { parseWidgetHistory } from "./widget-history-contract";

const id = "01900300-0000-7000-8000-0000000000a1";
const current = { versionNumber: 2, name: "Latest", provenance: "USER_PUBLISH", publishedAt: "2026-11-10T07:00:00Z" };
const backfill = { versionNumber: 1, name: "Original", provenance: "EXISTING_DEFINITION_BACKFILL", publishedAt: null };
const head = { widgetId: id, widgetRevision: 3, activeVersionNumber: 2 };

describe("widget version history", () => {
  it("binds data to the exact reviewed head", () => {
    const page = { ...head, items: [current, backfill], nextBeforeVersion: null };
    expect(parseWidgetHistory(page, id, 3, 2).items).toEqual([current, backfill]);
    expect(() => parseWidgetHistory(page, id, 4, 2)).toThrow();
    expect(() => parseWidgetHistory(page, id, 3, 1)).toThrow();
  });

  it("rejects a repeated boundary or a cursor that skips the last visible version", () => {
    expect(() => parseWidgetHistory({ ...head, items: [current], nextBeforeVersion: null }, id, 3, 2, 2)).toThrow();
    expect(() => parseWidgetHistory({ ...head, items: [current], nextBeforeVersion: 1 }, id, 3, 2)).toThrow();
  });

  it("keeps first-publication history empty and refuses inferred backfill dates", () => {
    expect(parseWidgetHistory({ ...head, activeVersionNumber: null, items: [], nextBeforeVersion: null }, id, 3, null).items).toEqual([]);
    expect(() => parseWidgetHistory({ ...head, items: [current, { ...backfill, publishedAt: current.publishedAt }], nextBeforeVersion: null }, id, 3, 2)).toThrow();
  });
});
