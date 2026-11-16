// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { EMPTY_NODE_FORM } from "../../inventory-contract";
import { useNodeForm } from "./useNodeForm";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
afterEach(() => { cleanup(); document.body.replaceChildren(); });

it("shows independent field errors, focuses the first invalid control, and clears a corrected field", async () => {
  const dialog = document.createElement("div"); dialog.setAttribute("role", "dialog");
  const first = document.createElement("input"); first.setAttribute("aria-invalid", "true"); dialog.append(first); document.body.append(dialog);
  const onSubmit = vi.fn();
  const { result } = renderHook(() => useNodeForm({ ...EMPTY_NODE_FORM, timezone: "Invalid/Timezone" }, onSubmit));
  await act(async () => { await result.current.submit(); });
  expect(result.current.fieldErrors).toEqual({ code: en.tradeInventory.nodeCodeInvalid, name: en.tradeInventory.formNameInvalid,
    timezone: en.tradeInventory.formTimezoneInvalid, branchIds: en.tradeInventory.formBranchesInvalid });
  expect(first).toHaveFocus();
  expect(onSubmit).not.toHaveBeenCalled();
  act(() => result.current.patch({ name: "Cairo distribution centre" }));
  expect(result.current.fieldErrors.name).toBeUndefined();
  expect(result.current.fieldErrors.code).toBe(en.tradeInventory.nodeCodeInvalid);
  expect(result.current.error).toBeNull();
});
