import { describe, expect, it } from "vitest";
import { moveRowKey } from "./row-reorder";

const ids = ["new", "contacted", "qualified", "won"];
const isEntry = (id: string) => id === "new";

describe("row-reorder", () => {
  it("moves a row to an arbitrary index, keeping every other key", () => {
    expect(moveRowKey(ids, 3, 1)).toEqual(["new", "won", "contacted", "qualified"]);
    expect(moveRowKey(ids, 1, 2)).toEqual(["new", "qualified", "contacted", "won"]);
  });

  it("refuses a no-op and anything outside the list", () => {
    expect(moveRowKey(ids, 2, 2)).toBeNull();
    expect(moveRowKey(ids, 0, -1)).toBeNull();
    expect(moveRowKey(ids, 3, 4)).toBeNull();
    expect(moveRowKey([], 0, 0)).toBeNull();
  });

  // The server pins the NEW lead stage to rank 1 and answers 422
  // LEAD_STAGE_REORDER_INVALID for any order that does not. Both halves of that
  // are one rule here: a pinned key that no longer sits at its own index.
  it("refuses a move that drags a pinned row, or drops another one through it", () => {
    expect(moveRowKey(ids, 0, 2, isEntry)).toBeNull();
    expect(moveRowKey(ids, 2, 0, isEntry)).toBeNull();
    expect(moveRowKey(ids, 3, 1, isEntry)).toEqual([
      "new",
      "won",
      "contacted",
      "qualified",
    ]);
  });
});
