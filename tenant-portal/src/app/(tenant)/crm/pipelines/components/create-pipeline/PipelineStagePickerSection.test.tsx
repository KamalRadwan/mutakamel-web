// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import type { OpportunityStageDefinition } from "../../pipeline-contract";
import { PipelineStagePickerSection } from "./PipelineStagePickerSection";

afterEach(cleanup);

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  // The real English dictionary, so a missing key fails the test rather than
  // rendering as empty text.
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

const stage = (
  id: string,
  nameEn: string,
  flag: OpportunityStageDefinition["flag"],
  category: OpportunityStageDefinition["category"],
  isActive = true,
): OpportunityStageDefinition => ({
  id,
  nameAr: nameEn,
  nameEn,
  flag,
  category,
  isActive,
  isSystem: true,
  createdAt: "",
  updatedAt: "",
});

const NEW = stage("s-new", "New", "NEW", "OPEN");
const PROPOSAL = stage("s-proposal", "Proposal", "PROPOSAL", "IN_PROGRESS");
const WON = stage("s-won", "Won", "WON", "POSITIVE");
const LOST = stage("s-lost", "Lost", "LOST", "NEGATIVE");
const RETIRED = stage("s-old", "Retired", "DISCOVERY", "IN_PROGRESS", false);

const catalogue = [NEW, PROPOSAL, WON, LOST, RETIRED];

function renderPicker(selectedIds: string[], onChange = vi.fn()) {
  render(
    <I18nProvider>
      <PipelineStagePickerSection
        catalogue={catalogue}
        selectedIds={selectedIds}
        disabled={false}
        isLoading={false}
        onChange={onChange}
      />
    </I18nProvider>,
  );
  return onChange;
}

describe("PipelineStagePickerSection", () => {
  it("says an empty selection means the default stages, rather than looking unfinished", () => {
    renderPicker([]);
    expect(screen.getByText(en.crmPipelines.create.stagesDefaultNote)).toBeInTheDocument();
  });

  it("never offers an inactive definition, which the service would refuse", () => {
    renderPicker([NEW.id, WON.id, LOST.id]);
    // 422 PIPELINE_STAGE_SELECTION_INVALID is what picking `Retired` would earn.
    expect(screen.queryByText("Retired")).not.toBeInTheDocument();
  });

  it("accepts a NEW-first order with one WON and one LOST", () => {
    renderPicker([NEW.id, PROPOSAL.id, WON.id, LOST.id]);
    expect(screen.queryByText(en.crmPipelines.create.stageProblems.NEW_NOT_FIRST)).toBeNull();
    expect(screen.queryByText(en.crmPipelines.create.stageProblems.MISSING_WON)).toBeNull();
  });

  it("names the rule that is broken instead of a generic refusal", () => {
    renderPicker([PROPOSAL.id, NEW.id, WON.id, LOST.id]);
    expect(
      screen.getByText(en.crmPipelines.create.stageProblems.NEW_NOT_FIRST),
    ).toBeInTheDocument();

    cleanup();
    renderPicker([NEW.id, PROPOSAL.id, WON.id]);
    expect(
      screen.getByText(en.crmPipelines.create.stageProblems.MISSING_LOST),
    ).toBeInTheDocument();
  });

  it("reorders through buttons, which a keyboard can reach", () => {
    const onChange = renderPicker([NEW.id, PROPOSAL.id, WON.id, LOST.id]);
    fireEvent.click(screen.getByRole("button", { name: "Move Proposal later" }));
    expect(onChange).toHaveBeenCalledWith([NEW.id, WON.id, PROPOSAL.id, LOST.id]);
  });

  it("cannot move the first entry earlier or the last one later", () => {
    renderPicker([NEW.id, PROPOSAL.id, WON.id, LOST.id]);
    expect(screen.getByRole("button", { name: "Move New earlier" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Lost later" })).toBeDisabled();
  });

  it("removes one entry and keeps the rest in order", () => {
    const onChange = renderPicker([NEW.id, PROPOSAL.id, WON.id, LOST.id]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Proposal" }));
    expect(onChange).toHaveBeenCalledWith([NEW.id, WON.id, LOST.id]);
  });

  it("offers a way back to the default six once a list has been started", () => {
    const onChange = renderPicker([NEW.id, WON.id, LOST.id]);
    fireEvent.click(
      screen.getByRole("button", { name: en.crmPipelines.create.useDefaultStages }),
    );
    // An empty selection omits `stageIds`, which is what seeds the canonical six.
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
