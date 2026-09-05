import { describe, expect, it } from "vitest";
import { INTL_LOCALE } from "@/lib/format/locale";
import {
  OTHER_JOB_TITLE_KEY,
  findHonorific,
  findJobTitle,
  getHonorificOptions,
  getJobTitleOptions,
} from "./contact-titles";

describe("honorifics", () => {
  it("offers the five the forms ask for, in both languages", () => {
    expect(getHonorificOptions("en").map((option) => option.label)).toEqual([
      "Mr",
      "Ms",
      "Mrs",
      "Dr",
      "Eng",
    ]);
    expect(getHonorificOptions("ar").map((option) => option.key)).toEqual([
      "MR",
      "MS",
      "MRS",
      "DR",
      "ENG",
    ]);
  });

  it("reads a stored honorific back in either language", () => {
    // Written in Arabic, read on an English screen: still Mr, and the stored
    // string is never rewritten by the reading.
    expect(findHonorific("السيد", "en")?.label).toBe("Mr");
    expect(findHonorific("Mr", "ar")?.label).toBe("السيد");
    expect(findHonorific("Sheikh", "en")).toBeNull();
  });
});

describe("job titles", () => {
  it("carries a hundred titles and the escape hatch, which sorts last", () => {
    const options = getJobTitleOptions("en");
    expect(options).toHaveLength(101);
    expect(options[options.length - 1].key).toBe(OTHER_JOB_TITLE_KEY);
  });

  it("sorts by the reader's own language rather than by key", () => {
    for (const lang of ["ar", "en"] as const) {
      const labels = getJobTitleOptions(lang)
        .filter((option) => option.key !== OTHER_JOB_TITLE_KEY)
        .map((option) => option.label);
      expect([...labels].sort((a, b) => a.localeCompare(b, INTL_LOCALE[lang]))).toEqual(labels);
    }
  });

  it("reads a stored title back in either language", () => {
    expect(findJobTitle("مدير المبيعات", "en")?.label).toBe("Sales manager");
    expect(findJobTitle("Sales manager", "ar")?.label).toBe("مدير المبيعات");
  });

  it("never matches the escape hatch, because `Other` is not a job", () => {
    // A form that stored the literal "Other" would show the list again and
    // lose whatever the person actually typed.
    expect(findJobTitle("Other", "en")).toBeNull();
    expect(findJobTitle("أخرى", "ar")).toBeNull();
  });

  it("leaves a title nobody in the list has as unrecognised", () => {
    expect(findJobTitle("Chief vibes officer", "en")).toBeNull();
  });
});
