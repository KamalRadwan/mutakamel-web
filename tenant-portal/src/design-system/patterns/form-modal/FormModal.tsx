"use client";

import { useEffect, useState } from "react";
import { cn } from "../../lib/cn";
import { proseMeasure } from "../../lib/variants";
import { Button } from "../../primitives/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../../primitives/Dialog";
import { ConfirmActionModal } from "../confirm-action/ConfirmActionModal";
import { FormErrorSummary } from "../form-shell/FormErrorSummary";
import { useFormShell } from "../form-shell/useFormShell";
import { FormDensityContext } from "./form-density";

export interface FormModalSection {
  /** Matches the `id` of the `FormSection` it points at. */
  id: string;
  label: string;
  /** Subtitle or explanatory text rendered below the label in stepper variant. */
  description?: string;
  /** A short state word beside the label — a count, "optional". Already translated. */
  hint?: string;
  /** Marks the entry as carrying an unresolved problem, so a collapsed section still says so. */
  invalid?: boolean;
  /**
   * For grouped or composite sections: any sub-section IDs that map to this step.
   * If any of these are the active section in scroll-spy, this step is marked active.
   */
  targetSectionIds?: string[];
}

export interface FormModalLabels {
  submit: string;
  cancel: string;
  discardTitle: string;
  discardDescription: string;
  discardConfirm: string;
  discardCancel: string;
  /** Accessible name for the section index. */
  sections: string;
  /** Screen-reader suffix on an index entry that has an error, e.g. "has errors". */
  sectionInvalid: string;
  close?: string;
}

export interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** `full` is the viewport less 20px. `wide` and `card` are centred surfaces without a section index. */
  size?: "full" | "wide" | "card";
  density?: "standard" | "compact";
  isDirty: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  /** A write's non-field failure. Rendered above the actions, where it stays visible. */
  error?: string;
  /** Blocks submit for a reason other than an in-flight request — a hard validation stop. */
  submitDisabled?: boolean;
  /** A persistent receipt has no second submit action. */
  hideSubmit?: boolean;
  /** Index entries, in document order. Omit for a modal with no section index. Rendered only at `size="full"`. */
  sections?: FormModalSection[];
  /** Section navigation visual style. "default" is a compact list of buttons; "stepper" is a numbered vertical timeline with titles and subtitles. */
  sectionVariant?: "default" | "stepper";
  /** Optional title / header element above the section navigation (e.g. "LEAD DETAILS"). */
  sidebarHeader?: React.ReactNode;
  /** Rendered in the header band, before the close button — a status chip, a scope note. */
  headerAside?: React.ReactNode;
  /** Rendered at the footer's inline start, opposite Cancel and Submit. */
  footerLeading?: React.ReactNode;
  labels: FormModalLabels;
  children: React.ReactNode;
}

/** Centred form with shared validation/dirty guard; layout contract: docs/design/patterns.md#formmodal. */
export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  size = "full",
  density = "standard",
  isDirty,
  isSubmitting,
  onSubmit,
  error,
  submitDisabled,
  hideSubmit = false,
  sections,
  sectionVariant = "default",
  sidebarHeader,
  headerAside,
  footerLeading,
  labels,
  children,
}: FormModalProps) {
  // A callback ref into state, not a `useRef`. Radix mounts the portal content
  // in a commit AFTER this component's first effect pass, so a ref read in the
  // scroll-spy below is null exactly when the modal first opens — and a ref
  // cannot re-run the effect to say otherwise. `setBody` is a state setter, so
  // its identity is stable and React does not detach it every render.
  const [body, setBody] = useState<HTMLDivElement | null>(null);
  const shell = useFormShell({
    body,
    open,
    isDirty,
    isSubmitting,
    error,
    submitDisabled: submitDisabled || hideSubmit,
    onSubmit,
    onOpenChange,
  });
  const [activeSection, setActiveSection] = useState<string | null>(null);
  // The effect below must not re-subscribe on every parent render, and a
  // `sections` array built inline at the call site is a new reference each
  // time. The ids are what it actually depends on.
  const sectionKey = (sections ?? [])
    .map((section) => `${section.id}:${(section.targetSectionIds ?? []).join(",")}`)
    .join("|");

  // Which section the reader is on. A scroll listener rather than an
  // IntersectionObserver: the answer wanted here is "the last heading that has
  // passed the top edge", which is a position question, and an observer only
  // reports threshold crossings — between two of them it would keep naming a
  // section the user has already scrolled past.
  useEffect(() => {
    const root = body;
    if (!root || sectionKey.length === 0) return;

    let frame = 0;
    const resolve = () => {
      frame = 0;
      const nodes = root.querySelectorAll<HTMLElement>("[data-form-section]");
      if (nodes.length === 0) return;
      const rootTop = root.getBoundingClientRect().top;
      let current = nodes[0].dataset.formSection ?? null;
      for (const node of nodes) {
        if (node.getBoundingClientRect().top - rootTop <= 24) {
          current = node.dataset.formSection ?? current;
        }
      }
      setActiveSection(current);
    };
    const onScroll = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(resolve);
    };

    resolve();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [body, sectionKey]);

  function goToSection(id: string) {
    const targetSection = sections?.find((s) => s.id === id);
    const targetId = targetSection?.targetSectionIds?.[0] ?? id;
    const nodes = body?.querySelectorAll<HTMLElement>("[data-form-section]");
    // Matched by reading the attribute rather than by building a selector, so a
    // section id never has to be escaped to be addressable.
    const node = [...(nodes ?? [])].find(
      (candidate) =>
        candidate.dataset.formSection === id ||
        candidate.dataset.formSection === targetId,
    );
    if (!node) return;
    const closedTrigger = node.querySelector<HTMLButtonElement>(
      'button[data-state="closed"], [data-state="closed"] button',
    );
    if (closedTrigger) {
      closedTrigger.click();
    }
    // No `behavior: "smooth"` here: the container carries `scroll-smooth`, so
    // the global prefers-reduced-motion reset can turn it off. A JS argument
    // would override that reset and animate anyway.
    node.scrollIntoView?.({ block: "start" });
    setActiveSection(node.dataset.formSection ?? id);
    // Scrolling moves the eye and leaves the keyboard behind. The heading is
    // the section's own focus target — see FormSection.
    node.querySelector<HTMLElement>("h3[tabindex], h4[tabindex], button[tabindex]")?.focus();
  }

  return (
    <FormDensityContext.Provider value={density}>
      <Dialog
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : shell.requestClose())}
      >
        <DialogContent
          size={size === "full" ? "full" : "2xl"}
          // The `2xl` size string is a centred card that carries `grid … gap-4
          // … p-6`; this override makes it the same flex column `full` already
          // is, with no padding of its own, because the header/body/footer
          // bands below own theirs. tailwind-merge resolves `grid`→`flex` and
          // `p-6`→`p-0` — both are last-wins groups.
          className={
            size === "full"
              ? undefined
              : cn(
                  "flex max-h-[85dvh] w-[calc(100%-2rem)] flex-col gap-0 p-0",
                  size === "wide" && "max-w-[960px]",
                )
          }
          closeLabel={labels.close}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            shell.requestClose();
          }}
          onPointerDownOutside={(event) => {
            event.preventDefault();
            shell.requestClose();
          }}
        >
          <form noValidate onSubmit={shell.handleSubmit} className="flex min-h-0 flex-1 flex-col">
            {/* pe-14 clears DialogContent's own close button, which is
                positioned against the content box rather than this band. */}
            <div className={cn("flex shrink-0 items-start justify-between border-b border-border", density === "compact" ? "gap-2 px-3 py-2 pe-14" : "gap-3 px-4 py-3 pe-14 sm:px-5")}>
              <div className="flex min-w-0 flex-col gap-1">
                <DialogTitle className={density === "compact" ? "text-sm" : undefined}>{title}</DialogTitle>
                {description && (
                  <DialogDescription className={cn(density === "compact" ? "text-xs" : "text-sm", proseMeasure)}>
                    {description}
                  </DialogDescription>
                )}
              </div>
              {headerAside && <div className="shrink-0">{headerAside}</div>}
            </div>

            <div className="flex min-h-0 flex-1">
              {size === "full" && sections && sections.length > 0 && (
                <nav
                  aria-label={labels.sections}
                  className={cn(
                    "hidden min-h-0 shrink-0 overflow-y-auto border-e border-border lg:block",
                    sectionVariant === "stepper"
                      ? "w-60 bg-muted/40 p-4"
                      : "w-56 bg-muted/40 p-2",
                  )}
                >
                  {sidebarHeader && (
                    <div className={sectionVariant === "stepper" ? "mb-4" : "mb-2 px-2 py-1"}>
                      {sidebarHeader}
                    </div>
                  )}

                  {sectionVariant === "stepper" ? (
                    <ol className="relative flex flex-col">
                      {sections.map((section, index) => {
                        const isCurrent =
                          (activeSection === null && index === 0) ||
                          activeSection === section.id ||
                          Boolean(
                            section.targetSectionIds &&
                              activeSection &&
                              section.targetSectionIds.includes(activeSection),
                          );

                        return (
                          <li
                            key={section.id}
                            className="relative flex gap-2.5 pb-5 last:pb-0"
                          >
                            {/* Vertical connector line */}
                            {index < sections.length - 1 && (
                              <div
                                aria-hidden="true"
                                className="absolute start-3.5 top-7 -bottom-1 w-px bg-border"
                              />
                            )}

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => goToSection(section.id)}
                              className="group -m-1 h-auto w-full items-start justify-start gap-3 p-1 whitespace-normal text-start"
                              aria-current={isCurrent ? "step" : undefined}
                            >
                              {/* Step circle marker */}
                              <span
                                className={cn(
                                  "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                                  isCurrent &&
                                    "border-primary bg-primary text-primary-foreground ring-4 ring-ring/15",
                                  !isCurrent &&
                                    !section.invalid &&
                                    "border-border bg-card text-muted-foreground",
                                  section.invalid &&
                                    "border-destructive bg-destructive/10 text-destructive ring-4 ring-destructive/15",
                                )}
                              >
                                {index + 1}
                              </span>

                              {/* Title and subtitle */}
                              <div className="flex min-w-0 flex-col">
                                <span
                                  className={cn(
                                    "text-sm font-semibold leading-tight transition-colors",
                                    isCurrent && "text-primary",
                                    !isCurrent &&
                                      !section.invalid &&
                                      "text-foreground group-hover:text-primary",
                                    section.invalid && "text-destructive",
                                  )}
                                >
                                  {section.label}
                                </span>
                                {section.description && (
                                  <span className="mt-1 text-xs leading-snug text-muted-foreground">
                                    {section.description}
                                  </span>
                                )}
                                {section.invalid && (
                                  <span className="sr-only">{labels.sectionInvalid}</span>
                                )}
                              </div>
                            </Button>
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <ol className="flex flex-col gap-0.5">
                      {sections.map((section) => (
                        <li key={section.id}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-current={activeSection === section.id ? "true" : undefined}
                            onClick={() => goToSection(section.id)}
                            className={cn(
                              "w-full justify-between gap-2 text-start font-normal",
                              activeSection === section.id && "bg-accent text-foreground",
                            )}
                          >
                            <span className="min-w-0 truncate">{section.label}</span>
                            {section.invalid ? (
                              <span className="shrink-0 text-destructive" aria-hidden="true">
                                !
                              </span>
                            ) : (
                              section.hint && (
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {section.hint}
                                </span>
                              )
                            )}
                            {section.invalid && <span className="sr-only">{labels.sectionInvalid}</span>}
                          </Button>
                        </li>
                      ))}
                    </ol>
                  )}
                </nav>
              )}

              {/* No tabIndex on the scroll region: it always contains focusable
                  fields, so a keyboard user scrolls it by tabbing through them.
                  Adding a stop here would put an unnamed one in front of every
                  field for no gain. `scroll-smooth` is a class rather than a
                  scrollIntoView argument so the global prefers-reduced-motion
                  reset in globals.css can switch it off. */}
              <div
                ref={setBody}
                // Contains Radix's absolute native select so focus cannot scroll the entire dialog.
                className={cn(
                  // This is a grid, not a constrained column flexbox. A flex
                  // body lets its section children shrink to fit the viewport;
                  // sections that also own `overflow-hidden` (for example an
                  // open Collapsible) then clip their fields before the body
                  // has any overflow to scroll. Max-content rows preserve each
                  // section's natural height and make this element the single
                  // scroll owner while the header and footer stay fixed.
                  "relative grid min-h-0 min-w-0 flex-1 auto-rows-max content-start overflow-y-auto scroll-smooth",
                  density === "compact"
                    ? "gap-2 px-3 py-2"
                    : "gap-4 px-4 py-3.5 sm:px-5",
                )}
              >
                {children}
              </div>
            </div>

            <div className={cn("flex shrink-0 flex-col gap-2 border-t border-border", density === "compact" ? "px-3 py-2" : "px-4 py-2.5 sm:px-5")}>
              <FormErrorSummary error={error} />
              <div className="flex flex-wrap items-center gap-2">
                {footerLeading && (
                  <div className="flex items-center gap-2">{footerLeading}</div>
                )}
                <div className="ms-auto flex items-center gap-2">
                  {/* Deliberately not DialogClose — that closes via Radix's own
                      context and would bypass the dirty guard. */}
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={shell.requestClose}
                    disabled={isSubmitting}
                  >
                    {labels.cancel}
                  </Button>
                  {!hideSubmit && (
                    <Button
                      size="sm"
                      type="submit"
                      variant="primary"
                      loading={isSubmitting}
                      disabled={submitDisabled}
                    >
                      {labels.submit}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionModal
        open={shell.confirmingDiscard}
        onOpenChange={shell.setConfirmingDiscard}
        title={labels.discardTitle}
        description={labels.discardDescription}
        confirmLabel={labels.discardConfirm}
        cancelLabel={labels.discardCancel}
        onConfirm={shell.confirmDiscard}
      />
    </FormDensityContext.Provider>
  );
}
