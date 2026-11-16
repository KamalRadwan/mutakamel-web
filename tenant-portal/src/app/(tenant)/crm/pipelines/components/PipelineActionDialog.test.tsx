// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { PipelineActionDialog } from "./PipelineActionDialog";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
afterEach(cleanup);

it("removes the destructive action after a server blocker and offers reconciliation", () => {
  const onConfirm = vi.fn();
  const onReload = vi.fn();
  render(<PipelineActionDialog open onOpenChange={vi.fn()} title="Delete pipeline" description="Delete this pipeline?"
    confirmLabel="Delete" pending={false} error="Pipeline is in use" blocked onConfirm={onConfirm} onReload={onReload} />);
  expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  expect(screen.getByRole("alert")).toHaveTextContent("Pipeline is in use");
  fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
  expect(onReload).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();
});
