// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import type { PipelineStage } from "../pipeline-contract";
import { PipelineStagesSection } from "./PipelineStagesSection";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
afterEach(cleanup);

const stages: PipelineStage[] = (["NEW", "PROPOSAL", "WON", "LOST"] as const).map((flag, index) => ({
  id: flag, pipelineId: "pipeline", opportunityStageId: flag, rank: index + 1,
  nameEn: flag, nameAr: flag, flag, category: flag === "WON" ? "POSITIVE" : flag === "LOST" ? "NEGATIVE" : "OPEN",
  isActive: true, isSystem: false,
}));

it("hides required-stage detach controls and prevents moves across NEW", () => {
  const onMove = vi.fn();
  const onDetach = vi.fn();
  render(<TooltipProvider><PipelineStagesSection
    stages={stages} attachableStages={[]} catalogueUnavailable={false}
    canManage pendingStageId={null} onAttach={vi.fn()} onDetach={onDetach} onMove={onMove}
  /></TooltipProvider>);

  for (const flag of ["NEW", "WON", "LOST"]) {
    expect(screen.queryByRole("button", { name: `${en.crmPipelines.detachStage}: ${flag}` })).toBeNull();
  }
  for (const [label, flag] of [
    [en.crmPipelines.moveEarlier, "NEW"],
    [en.crmPipelines.moveLater, "NEW"],
    [en.crmPipelines.moveEarlier, "PROPOSAL"],
  ]) {
    const button = screen.getByRole("button", { name: `${label}: ${flag}` });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
  }
  expect(onMove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: `${en.crmPipelines.moveLater}: PROPOSAL` }));
  expect(onMove).toHaveBeenCalledWith("PROPOSAL", 1);
  fireEvent.click(screen.getByRole("button", { name: `${en.crmPipelines.detachStage}: PROPOSAL` }));
  expect(onDetach).toHaveBeenCalledWith("PROPOSAL");
});
