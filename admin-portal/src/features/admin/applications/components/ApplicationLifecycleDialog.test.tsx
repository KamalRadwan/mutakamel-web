// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { ApplicationLifecycleDialog } from "./ApplicationLifecycleDialog";

const locale = vi.hoisted(() => ({ lang: "en" as "ar" | "en" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: locale.lang, dir: locale.lang === "ar" ? "rtl" : "ltr", t: locale.lang === "ar" ? ar : en }),
  useOptionalI18n: () => ({ lang: locale.lang, dir: locale.lang === "ar" ? "rtl" : "ltr", t: locale.lang === "ar" ? ar : en }),
}));

afterEach(() => {
  cleanup();
  locale.lang = "en";
  vi.clearAllMocks();
});

type Props = React.ComponentProps<typeof ApplicationLifecycleDialog>;

async function renderDialog(overrides: Partial<Props> = {}) {
  const props: Props = {
    action: "disable", applicationKey: "crm", currentStatus: "ACTIVE", isSubmitting: false,
    onClose: vi.fn(), onConfirm: vi.fn().mockResolvedValue(undefined), ...overrides,
  };
  const view = render(<ApplicationLifecycleDialog {...props} />);
  // Let the opening effect clear the previous confirmation fields.
  await act(async () => {});
  return { ...view, props };
}

function fillDisable(reason = "Retiring CRM", key = "crm") {
  const copy = (locale.lang === "ar" ? ar : en).applications.detail.lifecycle;
  fireEvent.change(screen.getByRole("textbox", { name: copy.confirmApplicationKey }), { target: { value: key } });
  fireEvent.change(screen.getByRole("textbox", { name: copy.reason }), { target: { value: reason } });
}

function confirmButton() {
  const copy = (locale.lang === "ar" ? ar : en).applications.detail.lifecycle;
  return screen.getByRole("button", { name: `${copy.confirm} ${copy.disable}` });
}

describe("ApplicationLifecycleDialog disable safety", () => {
  it.each(["en", "ar"] as const)("shows the irreversible warning and confirmation fields in %s", async (lang) => {
    locale.lang = lang;
    const { props } = await renderDialog();
    const copy = (lang === "ar" ? ar : en).applications.detail.lifecycle;
    expect(screen.getByRole("alert")).toHaveTextContent(copy.disableWarning);
    expect(screen.getByText(copy.disableReasonMinimum)).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
    fillDisable("  12345678  ");
    expect(confirmButton()).toBeEnabled();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(props.onConfirm).toHaveBeenCalledWith("12345678"));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it.each([
    ["", "Retiring CRM"], ["CRM", "Retiring CRM"], [" crm ", "Retiring CRM"],
    ["crm", ""], ["crm", " 1234567 "],
  ])("rejects key %j and reason %j, including direct form submission", async (key, reason) => {
    const { props } = await renderDialog();
    fillDisable(reason, key);
    expect(confirmButton()).toBeDisabled();
    fireEvent.submit(confirmButton().closest("form")!);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("rejects disable from DRAFT even with valid confirmation", async () => {
    const { props } = await renderDialog({ currentStatus: "DRAFT" });
    fillDisable();
    expect(confirmButton()).toBeDisabled();
    fireEvent.submit(confirmButton().closest("form")!);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("allows disable from DEPRECATED", async () => {
    const { props } = await renderDialog({ currentStatus: "DEPRECATED" });
    fillDisable();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(props.onConfirm).toHaveBeenCalledOnce());
  });

  it("blocks double submit and dismissal while the parent loading prop is still false", async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    const { props } = await renderDialog({ onConfirm });
    fillDisable();
    const form = confirmButton().closest("form")!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: en.applications.cancel })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: en.common.close }));
    expect(props.onClose).not.toHaveBeenCalled();
    await act(async () => { resolve(); });
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("blocks direct submission while the parent reports an ongoing command", async () => {
    const { props } = await renderDialog({ isSubmitting: true });
    fireEvent.submit(confirmButton().closest("form")!);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("releases the submit guard after rejection so the operator can retry", async () => {
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error("Rejected")).mockResolvedValueOnce(undefined);
    const { props } = await renderDialog({ onConfirm });
    fillDisable();
    fireEvent.click(confirmButton());
    expect(await screen.findByText("Rejected")).toBeInTheDocument();
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("clears confirmation when the target application changes", async () => {
    const { props, rerender } = await renderDialog();
    fillDisable();
    rerender(<ApplicationLifecycleDialog {...props} applicationKey="trade" />);
    await act(async () => {});
    expect(screen.getByRole("textbox", { name: en.applications.detail.lifecycle.confirmApplicationKey })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: en.applications.detail.lifecycle.reason })).toHaveValue("");
    expect(confirmButton()).toBeDisabled();
  });

  it.each(["activate", "deprecate"] as const)("keeps %s gated only by a non-empty reason", async (action) => {
    const { props } = await renderDialog({ action });
    const copy = en.applications.detail.lifecycle;
    expect(screen.queryByText(copy.disableWarning)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: copy.confirmApplicationKey })).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: `${copy.confirm} ${copy[action]}` });
    fireEvent.click(button);
    expect(await screen.findByText(copy.reasonRequired)).toBeInTheDocument();
    expect(props.onConfirm).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: copy.reason }), { target: { value: " x " } });
    fireEvent.click(button);
    await waitFor(() => expect(props.onConfirm).toHaveBeenCalledWith("x"));
  });
});
