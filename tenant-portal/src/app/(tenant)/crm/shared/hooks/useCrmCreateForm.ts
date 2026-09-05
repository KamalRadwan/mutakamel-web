"use client";

import { useCallback, useMemo, useState } from "react";

/** Field path -> message. `contacts.0.email`, `address.city`, `customFields.budget`. */
export type CrmFormErrors = Record<string, string>;

export interface CrmCreateFormOptions<TForm> {
  /** Built lazily, once per reset, so a fresh row key is minted per open. */
  createInitial: () => TForm;
  /** Pure and cheap — it runs on every render. */
  validate: (form: TForm) => CrmFormErrors;
  /**
   * What the dirty guard compares. Defaults to the whole form.
   *
   * A form carrying React row keys overrides this to drop them: a row added
   * then removed is not a change the user made, and a guard that says it is
   * asks a question with no answer behind it.
   */
  fingerprint?: (form: TForm) => string;
}

export interface CrmCreateForm<TForm> {
  form: TForm;
  /** The errors the user is allowed to see yet. What `Field error=` takes. */
  errors: CrmFormErrors;
  /** Every error, including the silent ones. What submit is gated on. */
  allErrors: CrmFormErrors;
  isDirty: boolean;
  setForm: React.Dispatch<React.SetStateAction<TForm>>;
  setField: <K extends keyof TForm>(key: K, value: TForm[K]) => void;
  /** Marks a path blurred, which is what lets its error start showing. */
  touch: (path: string) => void;
  /** Reveals every error. Called from submit so a never-blurred field still speaks. */
  revealAll: () => void;
  reset: () => void;
}

function defaultFingerprint<TForm>(form: TForm): string {
  return JSON.stringify(form);
}

/**
 * The state every CRM create form needs, minus the fields themselves.
 *
 * Errors stay silent until the field they belong to has been blurred, then run
 * live until it is valid again — docs/design/primitives.md#validate-on-blur-not-on-keystroke.
 * A shared touched-set rather than one `useBlurValidation` per field, because
 * these forms carry dynamic rows (contacts, phones, stages) and a hook cannot
 * be called per row.
 *
 * Extracted from the create-lead form once customer profiles, pipelines and
 * opportunities needed the identical behaviour: four copies of a reveal rule is
 * four chances for one screen to start shouting at a user who has typed nothing.
 */
export function useCrmCreateForm<TForm>({
  createInitial,
  validate,
  fingerprint = defaultFingerprint,
}: CrmCreateFormOptions<TForm>): CrmCreateForm<TForm> {
  // The pristine snapshot is STATE, not a ref: `isDirty` is rendered output,
  // and a value that render reads has to be one React knows about.
  const [initial, setInitial] = useState<TForm>(createInitial);
  const [form, setForm] = useState<TForm>(initial);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [revealed, setRevealed] = useState(false);

  const allErrors = useMemo(() => validate(form), [form, validate]);

  const errors = useMemo(() => {
    if (revealed) return allErrors;
    return Object.fromEntries(
      Object.entries(allErrors).filter(([path]) => touched.has(path)),
    );
  }, [allErrors, revealed, touched]);

  const isDirty = fingerprint(form) !== fingerprint(initial);

  const setField = useCallback(
    <K extends keyof TForm>(key: K, value: TForm[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const touch = useCallback((path: string) => {
    setTouched((current) => (current.has(path) ? current : new Set(current).add(path)));
  }, []);

  const revealAll = useCallback(() => setRevealed(true), []);

  const reset = useCallback(() => {
    const pristine = createInitial();
    setInitial(pristine);
    setForm(pristine);
    setTouched(new Set());
    setRevealed(false);
  }, [createInitial]);

  return { form, errors, allErrors, isDirty, setForm, setField, touch, revealAll, reset };
}
