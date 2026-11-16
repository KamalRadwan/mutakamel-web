// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { parseCrmCustomField } from "../custom-field-contract";
import { useCustomFieldForm } from "./useCustomFieldForm";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
afterEach(cleanup);

const option = { key: "web", nameAr: "الموقع", nameEn: "Website", sortOrder: 1, isActive: true };
const definition = parseCrmCustomField({
  id: "0191e9a8-7f51-7b32-8d72-19f9217a41b3", ownerType: "LEAD", fieldKey: "channel",
  nameAr: "القناة", nameEn: "Channel", type: "SELECT", options: [option],
  isActive: true, isSearchable: false, sortOrder: 1,
});

describe("custom-field form", () => {
  it("restores saved activity without losing edited names, ordering or new options", () => {
    const inactive = { key: "legacy", nameAr: "قديم", nameEn: "Legacy", sortOrder: 2, isActive: false };
    const { result } = renderHook(() => useCustomFieldForm({ ...definition, options: [option, inactive] }));
    act(() => {
      result.current.updateOption(result.current.options[0].rowId, { nameEn: "Renamed", sortOrder: 5, isActive: false });
      result.current.updateOption(result.current.options[1].rowId, { nameAr: "اسم معدل", isActive: true });
      result.current.addOption();
    });
    act(() => result.current.updateOption(result.current.options[2].rowId, {
      key: "new", nameAr: "جديد", nameEn: "New", isActive: false,
    }));
    expect(result.current.optionActivityChanged).toBe(true);
    act(() => result.current.restoreOptionActivity());
    expect(result.current.options).toEqual([
      expect.objectContaining({ ...option, nameEn: "Renamed", sortOrder: 5, isActive: true, persisted: true }),
      expect.objectContaining({ ...inactive, nameAr: "اسم معدل", isActive: false, persisted: true }),
      expect.objectContaining({ key: "new", nameAr: "جديد", nameEn: "New", isActive: false, persisted: false }),
    ]);
    expect(result.current.optionActivityChanged).toBe(false);
    expect(result.current.isDirty).toBe(true);
  });

  it("opens additional settings when hidden metadata fails validation", async () => {
    const submit = vi.fn();
    const { result } = renderHook(() => useCustomFieldForm());
    expect(result.current.metadataOpen).toBe(false);
    act(() => {
      result.current.setNameAr("القناة"); result.current.setNameEn("Channel");
      result.current.setFieldKey("channel"); result.current.setSortOrder("0");
    });
    await act(async () => result.current.submitCreate(submit, vi.fn()));
    expect(result.current.metadataOpen).toBe(true);
    expect(result.current.metadataError).toBe(en.crmCustomFields.invalidMetadata);
    expect(submit).not.toHaveBeenCalled();
  });

  it("submits backed optional metadata and blocks invalid display orders and long placeholders", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useCustomFieldForm());
    act(() => {
      result.current.setNameAr("القناة"); result.current.setNameEn("Channel"); result.current.setFieldKey("channel");
      result.current.setPlaceholderEn("Choose a channel"); result.current.setPlaceholderAr("اختر القناة");
      result.current.setSortOrder("2"); result.current.setIsSearchable(true);
    });
    await act(async () => result.current.submitCreate(submit, vi.fn()));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ placeholderEn: "Choose a channel", placeholderAr: "اختر القناة", sortOrder: 2, isSearchable: true }));
    submit.mockClear();
    for (const order of ["0", "-1", "1.5", "", "9007199254740992"]) {
      act(() => result.current.setSortOrder(order));
      await act(async () => result.current.submitCreate(submit, vi.fn()));
    }
    act(() => { result.current.setSortOrder("1"); result.current.setPlaceholderEn("x".repeat(181)); });
    await act(async () => result.current.submitCreate(submit, vi.fn()));
    expect(submit).not.toHaveBeenCalled();
  });

  it("can explicitly clear saved placeholders without changing a field identity", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useCustomFieldForm({ ...definition, placeholderEn: "Choose", placeholderAr: "اختر" }));
    act(() => { result.current.setPlaceholderEn(""); result.current.setPlaceholderAr(""); result.current.setSortOrder("4"); });
    await act(async () => result.current.submitEdit(submit));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ placeholderEn: "", placeholderAr: "", sortOrder: 4 }));
    expect(submit.mock.calls[0][0]).not.toHaveProperty("fieldKey");
  });
  it.each(["SELECT", "MULTI_SELECT"] as const)("creates %s with DTO-only option fields", async (type) => {
    const submit = vi.fn().mockResolvedValue(true);
    const close = vi.fn();
    const { result } = renderHook(() => useCustomFieldForm());
    act(() => {
      result.current.setNameAr(" القناة ");
      result.current.setNameEn(" Channel ");
      result.current.setFieldKey(" Preferred Channel ");
      result.current.setType(type);
      result.current.addOption();
    });
    act(() => result.current.updateOption(result.current.options[0].rowId, option));
    await act(async () => result.current.submitCreate(submit, close));
    expect(submit).toHaveBeenCalledWith({
      nameAr: "القناة", nameEn: "Channel", fieldKey: "preferred_channel", ownerType: "LEAD",
      type, isSearchable: false, options: [option],
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("blocks missing options and duplicate keys, and omits options for a simple type", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    const close = vi.fn();
    const { result } = renderHook(() => useCustomFieldForm());
    act(() => {
      result.current.setNameAr("القناة"); result.current.setNameEn("Channel");
      result.current.setFieldKey("channel"); result.current.setType("SELECT");
    });
    await act(async () => result.current.submitCreate(submit, close));
    expect(submit).not.toHaveBeenCalled();
    expect(result.current.optionsError).toBe(en.crmCustomFields.invalidOptions);
    act(() => result.current.addOption());
    act(() => result.current.addOption());
    act(() => result.current.options.forEach(({ rowId }) => result.current.updateOption(rowId, option)));
    await act(async () => result.current.submitCreate(submit, close));
    expect(submit).not.toHaveBeenCalled();
    act(() => result.current.setType("TEXT"));
    await act(async () => result.current.submitCreate(submit, close));
    expect(submit.mock.calls[0][0]).not.toHaveProperty("options");
  });

  it("preserves persisted option keys and rows while allowing label and active changes", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useCustomFieldForm(definition));
    const rowId = result.current.options[0].rowId;
    act(() => {
      result.current.removeOption(rowId);
      result.current.updateOption(rowId, { key: "replacement", nameEn: "Web", isActive: false });
      result.current.setNameEn("Acquisition channel");
      result.current.setIsActive(false);
      result.current.setIsSearchable(true);
    });
    expect(result.current.options).toHaveLength(1);
    expect(result.current.options[0].key).toBe("web");
    expect(result.current.isDirty).toBe(true);
    await act(async () => result.current.submitEdit(submit));
    expect(submit).toHaveBeenCalledWith({ nameAr: "القناة", nameEn: "Acquisition channel", isActive: false,
      isSearchable: true, options: [{ ...option, nameEn: "Web", isActive: false }] });
    expect(submit.mock.calls[0][0]).not.toHaveProperty("fieldKey");
    expect(submit.mock.calls[0][0]).not.toHaveProperty("type");
  });

  it("omits unchanged options when saving definition metadata", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useCustomFieldForm(definition));
    act(() => result.current.setIsActive(false));
    await act(async () => result.current.submitEdit(submit));
    expect(submit).toHaveBeenCalledWith({ nameAr: "القناة", nameEn: "Channel", isActive: false, isSearchable: false });
  });

  it("validates name bounds and keeps the form open on a rejected write", async () => {
    const submit = vi.fn().mockResolvedValue(false);
    const close = vi.fn();
    const { result } = renderHook(() => useCustomFieldForm());
    act(() => {
      result.current.setFieldKey("channel"); result.current.setNameAr("القناة");
      result.current.setNameEn("x".repeat(121));
    });
    await act(async () => result.current.submitCreate(submit, close));
    expect(submit).not.toHaveBeenCalled();
    act(() => result.current.setNameEn("Channel"));
    await act(async () => result.current.submitCreate(submit, close));
    expect(close).not.toHaveBeenCalled();
  });
});
