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
  /** A short state word beside the label — a count, "optional". Already translated. */
  hint?: string;
  /** Marks the entry as carrying an unresolved problem, so a collapsed section still says so. */
  invalid?: boolean;
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
  /** `full` is the viewport less 20px. `card` is a centred 672px card for a short create form that has no sections. */
  size?: "full" | "card";
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
  const sectionKey = (sections ?? []).map((section) => section.id).join("|");

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
    const nodes = body?.querySelectorAll<HTMLElement>("[data-form-section]");
    // Matched by reading the attribute rather than by building a selector, so a
    // section id never has to be escaped to be addressable.
    const node = [...(nodes ?? [])].find((candidate) => candidate.dataset.formSection === id);
    if (!node) return;
    // No `behavior: "smooth"` here: the container carries `scroll-smooth`, so
    // the global prefers-reduced-motion reset can turn it off. A JS argument
    // would override that reset and animate anyway.
    node.scrollIntoView?.({ block: "start" });
    setActiveSection(id);
    // Scrolling moves the eye and leaves the keyboard behind. The heading is
    // the section's own focus target — see FormSection.
    node.querySelector<HTMLElement>("h3[tabindex]")?.focus();
  }

  return (
    <FormDensityContext.Provider value={density}>
      <Dialog
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : shell.requestClose())}
      >
        <DialogContent
          size={size === "card" ? "2xl" : "full"}
          // The `2xl` size string is a centred card that carries `grid … gap-4
          // … p-6`; this override makes it the same flex column `full` already
          // is, with no padding of its own, because the header/body/footer
          // bands below own theirs. tailwind-merge resolves `grid`→`flex` and
          // `p-6`→`p-0` — both are last-wins groups.
          className={
            size === "card" ? "flex max-h-[85dvh] flex-col gap-0 p-0" : undefined
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
            <div className={cn("flex shrink-0 items-start justify-between border-b border-border", density === "compact" ? "gap-2 px-3 py-2 pe-14" : "gap-3 px-4 py-3 pe-14 sm:px-6")}>
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
                  className="hidden w-56 shrink-0 overflow-y-auto border-e border-border bg-muted/40 p-2 lg:block"
                >
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
                className={cn("relative flex min-w-0 flex-1 scroll-smooth flex-col overflow-y-auto", density === "compact" ? "gap-2 px-3 py-2" : "gap-6 px-4 py-4 sm:px-6")}
              >
                {children}
              </div>
            </div>

            <div className={cn("flex shrink-0 flex-col gap-2 border-t border-border", density === "compact" ? "px-3 py-2" : "px-4 py-3 sm:px-6")}>
              <FormErrorSummary error={error} />
              <div className="flex flex-wrap items-center gap-2">
                {footerLeading && (
                  <div className="flex items-center gap-2">{footerLeading}</div>
                )}
                <div className="ms-auto flex items-center gap-2">
                  {/* Deliberately not DialogClose — that closes via Radix's own
                      context and would bypass the dirty guard. */}
                  <Button
                    size={density === "compact" ? "sm" : "md"}
                    type="button"
                    variant="outline"
                    onClick={shell.requestClose}
                    disabled={isSubmitting}
                  >
                    {labels.cancel}
                  </Button>
                  {!hideSubmit && <Button
                    size={density === "compact" ? "sm" : "md"}
                    type="submit"
                    variant="primary"
                    loading={isSubmitting}
                    disabled={submitDisabled}
                  >
                    {labels.submit}
                  </Button>}
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
