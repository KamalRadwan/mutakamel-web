// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { PipelineAssignmentsSection } from "./PipelineAssignmentsSection";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
afterEach(cleanup);

function makeState(): Parameters<typeof PipelineAssignmentsSection>[0]["state"] {
  const diff = { added: [], removed: [], unchanged: [] };
  return {
    assignments: { accessMode: "ALL", userIds: [], teamIds: [] },
    accessMode: "ALL", setAccessMode: vi.fn(), userIds: [], setUserIds: vi.fn(),
    teamIds: [], setTeamIds: vi.fn(), users: [], teams: [], optionsQuery: "",
    searchOptions: vi.fn(), isLoading: false, isLoadingOptions: false,
    isSaving: false, loadError: null, optionsError: null,
    userDiff: diff, teamDiff: diff, isDirty: false,
    save: vi.fn(async () => ({ ok: true, replayed: false, error: null })),
    revert: vi.fn(), reload: vi.fn(async () => {}),
  };
}

it.each([true, false])("locks the access selector only for the default pipeline (%s)", (isDefault) => {
  render(<PipelineAssignmentsSection state={makeState()} canManage isDefault={isDefault} onSave={vi.fn()} />);
  expect((screen.getByRole("combobox") as HTMLButtonElement).disabled).toBe(isDefault);
  if (isDefault) expect(screen.getByText(en.crmPipelines.defaultAccessModeHint)).toBeTruthy();
});

it("blocks a restricted draft from saving after the pipeline becomes default", () => {
  const state = makeState();
  state.accessMode = "RESTRICTED";
  state.isDirty = true;
  const onSave = vi.fn();
  render(<PipelineAssignmentsSection state={state} canManage isDefault onSave={onSave} />);
  const save = screen.getByRole("button", { name: en.crmPipelines.saveAssignments });
  expect((save as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(save);
  expect(onSave).not.toHaveBeenCalled();
});
