import { describe, expect, it } from "vitest";
import {
  ALL_SERVERS,
  serverFilterOptions,
  serverFilterSelection,
  serverFilterValue,
} from "./server-filter-options";

const servers = [
  { id: "019f0000-0000-7000-8000-00000000000a", name: "Cairo PostgreSQL 01" },
  { id: "019f0000-0000-7000-8000-00000000000b", name: "Dubai PostgreSQL 02" },
];

/**
 * FE-BK02. The option list used to hold only concrete server ids, so "all
 * servers" existed as the trigger's placeholder for the empty state and as
 * nothing else. Once the operator picked a server there was no option to go
 * back, and the only way to widen the view again was to reload the page.
 */
describe("backup server filter options", () => {
  it("always offers all servers, ahead of the servers themselves", () => {
    const options = serverFilterOptions(servers, "All servers");

    expect(options[0]).toEqual({ value: ALL_SERVERS, label: "All servers" });
    expect(options.map((option) => option.label)).toEqual([
      "All servers",
      "Cairo PostgreSQL 01",
      "Dubai PostgreSQL 02",
    ]);
  });

  it("offers the way back even when no server has loaded yet", () => {
    expect(serverFilterOptions([], "All servers")).toEqual([
      { value: ALL_SERVERS, label: "All servers" },
    ]);
  });

  it("never emits an empty option value", () => {
    // Radix throws on an empty SelectItem value, which is why the sentinel
    // exists rather than reusing the stored empty filter directly.
    for (const option of serverFilterOptions(servers, "All servers")) {
      expect(option.value).not.toBe("");
    }
  });

  it("round-trips the stored filter through the sentinel", () => {
    expect(serverFilterValue("")).toBe(ALL_SERVERS);
    expect(serverFilterValue(servers[0].id)).toBe(servers[0].id);

    expect(serverFilterSelection(ALL_SERVERS)).toBe("");
    expect(serverFilterSelection(servers[0].id)).toBe(servers[0].id);
  });
});
