import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// `POST /crm/leads` is `idempotencyMode: "WRITE_SENSITIVE"` with
// `idempotent: true` in the Gateway contract, so it answers
// 400 GW.IDEM.MISSING to a request with no `x-idempotency-key`. Save was doing
// exactly that: it passed `skipAutoIdempotency: true` to the transport — which
// was right while the route did not demand a key, and became a broken Save the
// day it did.
//
// Read from source because the alternative is standing up the whole hook —
// auth context, branch selection, i18n — to observe one header. The invariant
// is small and structural: this write goes through `runCrmWrite`, which is the
// only thing in CRM that pairs a key with an attempt and replays it rather than
// minting a second one.
const source = readFileSync(resolve(__dirname, "./useLeads.ts"), "utf8");

function block(startMarker: string): string {
  const start = source.indexOf(startMarker);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("\n  const handleDelete", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("creating a lead", () => {
  const handleCreate = block("const handleCreate = async");

  it("sends the write through the attempt-keyed CRM writer", () => {
    expect(handleCreate).toContain("createCrmWriteAttempt()");
    expect(handleCreate).toContain("runCrmWrite(");
  });

  it("never tells the transport to skip the key on this route", () => {
    // The transport mints a fresh key per request when none is supplied, which
    // is the wrong shape for a retry but still satisfies the Gateway. Skipping
    // it supplies nothing at all, and that is the 400.
    expect(handleCreate).not.toContain("skipAutoIdempotency");
  });

  it("treats an unreadable-but-applied result as a lead that may exist", () => {
    // A duplicate lead is the failure this guards: leaving the filled modal
    // open invites a second Save, and that is a second attempt with a second
    // key, which the Gateway has no reason to collapse.
    expect(handleCreate).toContain("outcome.kind === \"success\"");
    expect(handleCreate).toContain("outcome.kind === \"failed\"");
    expect(handleCreate).toContain("setIsCreateOpen(false)");
  });

  it("keeps tags inside the one idempotent create write", () => {
    expect(handleCreate).toContain("buildCreateLeadRequest(form, branchId)");
    expect(handleCreate).not.toContain("/tags");
  });
});
