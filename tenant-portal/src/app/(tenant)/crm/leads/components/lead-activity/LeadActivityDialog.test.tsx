// @vitest-environment jsdom

/**
 * The activity dialog the card's mark opens.
 *
 * What these prove: both halves are on screen at once and each input carries a
 * real associated label; the create is a POST to **Core's** activities route
 * with the lead as its target and one UUIDv7 `x-idempotency-key`; the list is
 * re-read afterwards so the half reflects what was just booked, and the board
 * is told so the card's mark can change colour; and a due date in the past is
 * refused before a key is spent on it.
 *
 * What they cannot prove: that the halves are side by side. jsdom has no
 * layout, so the responsive split is a class contract here and a browser check
 * elsewhere.
 */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { api, authMock } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  authMock: {
    user: { permissions: ["activities.read", "activities.create"], isTenantOwner: false },
    isLoading: false,
  },
}));

vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  // Only the request surface is replaced: `unwrapCoreData` stays the real one,
  // so the envelope this dialog reads is the envelope Core actually sends.
  ...(await importOriginal<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: api,
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => authMock }));

import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { IDEMPOTENCY_KEY_HEADER } from "../../../shared/crm-write";
import { LeadActivityDialog } from "./LeadActivityDialog";

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

const copy = en.crmLeads.activities;
const LEAD = { id: "01900100-0000-7000-8000-000000000001", name: "Acme Trading" };
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function listBody(items: unknown[]) {
  return { data: { success: true, data: { items, total: items.length }, correlationId: "c" } };
}

const PLANNED = {
  id: "01900100-0000-7000-8000-0000000000b1",
  subject: "Ring the buyer",
  type: "CALL",
  priority: "URGENT",
  dueAt: "2026-09-06T09:00:00.000Z",
};

/** `datetime-local` text, in the viewer's own zone, N hours from now. */
function localInput(hours: number): string {
  const at = new Date(Date.now() + hours * 60 * 60 * 1000);
  return new Date(at.getTime() - at.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function renderDialog() {
  const onCreated = vi.fn();
  const onClose = vi.fn();
  render(
    <I18nProvider>
      <LeadActivityDialog lead={LEAD} onClose={onClose} onCreated={onCreated} />
    </I18nProvider>,
  );
  return { onCreated, onClose };
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue(listBody([PLANNED]));
  api.post.mockResolvedValue({
    data: { success: true, data: { ...PLANNED, subject: "Site visit" }, correlationId: "c" },
    headers: new Headers(),
    status: 201,
  });
});

afterEach(cleanup);

describe("the lead activity dialog", () => {
  it("shows the lead's planned work beside the form that adds more", async () => {
    renderDialog();

    expect(screen.getByText(copy.openHeading)).toBeInTheDocument();
    expect(screen.getByText(copy.createHeading)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent(LEAD.name);
    await screen.findByText(PLANNED.subject);
    // Urgency is a hue AND a word, so the badge still says which of the four
    // levels this is in a greyscale screenshot. Scoped to the list, because
    // "Urgent" is also one of the form's priority options next door.
    const planned = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(planned).toHaveLength(1);
    expect(planned[0]).toHaveTextContent(copy.priorities.URGENT);
    expect(planned[0]).toHaveTextContent(copy.types.CALL);
  });

  // ui-ux-pro-max, Accessibility/Form Labels — High: an input whose only
  // prompt is its placeholder has no accessible name. `Field` renders a real
  // <label for>, and this is the assertion that keeps it that way.
  it("gives every input an associated label", () => {
    renderDialog();
    for (const label of [copy.typeLabel, copy.subject, copy.dueAt, copy.priority, copy.notes]) {
      expect(screen.getByLabelText(label, { exact: false })).toBeInTheDocument();
    }
  });

  it("asks Core for this lead's PLANNED activities only", async () => {
    renderDialog();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    const path = String(api.get.mock.calls[0][0]);
    expect(path).toContain("/api/tenant/core/v1/activities?");
    // Never /crm/v1/activities: that route's writes land DONE rows.
    expect(path).not.toContain("/crm/v1/activities");
    const query = new URLSearchParams(path.split("?")[1]);
    expect(query.get("status")).toBe("PLANNED");
    expect(query.get("targetType")).toBe("LEAD");
    expect(query.get("targetId")).toBe(LEAD.id);
  });

  it("posts one activity under a single UUIDv7 idempotency key, and re-reads the list", async () => {
    const { onCreated } = renderDialog();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));

    fill(copy.subject, "Site visit");
    fill(copy.dueAt, localInput(24));
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [path, body, config] = api.post.mock.calls[0];
    expect(path).toBe("/api/tenant/core/v1/activities");
    expect(body).toMatchObject({
      target: { app: "CRM", type: "LEAD", id: LEAD.id },
      subject: "Site visit",
    });
    // `POST /activities` is `idempotent: true` in the Gateway contract, so the
    // key is mandatory — and the transport is told not to mint its own, which
    // is what makes a retry reuse this one instead of booking a second call.
    expect(config.headers[IDEMPOTENCY_KEY_HEADER]).toMatch(UUID_V7);
    expect(config.skipAutoIdempotency).toBe(true);

    // The half has to show what was just booked, and the board has to be told
    // so the card's mark can be repainted from the server's own bucket.
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(copy.created)).toBeInTheDocument();
  });

  // `ActivitiesService.create` runs `assertFutureDueAt`. Catching it here
  // costs no round trip and, more to the point, spends no idempotency key.
  it("refuses a due date in the past without sending anything", async () => {
    renderDialog();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));

    fill(copy.subject, "Site visit");
    fill(copy.dueAt, localInput(-1));
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));

    expect(await screen.findByText(copy.errors.past)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("states an empty list rather than leaving the half blank", async () => {
    api.get.mockResolvedValue(listBody([]));
    renderDialog();
    expect(await screen.findByText(copy.empty)).toBeInTheDocument();
  });

  // Not being able to READ this lead's activities is no reason to stop
  // someone booking one, so the failure is stated in its own half and the
  // form beside it keeps working.
  it("reports a failed list without disabling the form beside it", async () => {
    api.get.mockRejectedValue(new Error("boom"));
    renderDialog();
    expect(await screen.findByText(copy.loadFailed)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.subject, { exact: false })).toBeEnabled();
  });

  it("says why the form is dead when the user may not create activities", async () => {
    authMock.user = { permissions: ["activities.read"], isTenantOwner: false };
    renderDialog();
    expect(await screen.findByText(copy.createNotPermitted)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.submit })).toBeDisabled();
    authMock.user = {
      permissions: ["activities.read", "activities.create"],
      isTenantOwner: false,
    };
  });

  // The two halves stack below `md` instead of squeezing — a five-field form
  // in half a phone screen is how a dialog earns a horizontal scrollbar, which
  // ui-ux-pro-max flags at High severity.
  it("splits into two halves only from md up", async () => {
    renderDialog();
    const split = within(screen.getByRole("dialog"))
      .getByText(copy.openHeading)
      .closest("section")?.parentElement;
    expect(split?.className).toContain("md:grid-cols-2");
    expect(split?.className).not.toContain("grid-cols-2 ");
  });
});
