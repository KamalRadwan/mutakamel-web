"use client";

import { useId, type ReactNode } from "react";
import { Check, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import {
  Badge,
  Button,
  Field,
  Input,
  cn,
  focusRing,
} from "@/design-system";
import { webphoneFieldErrorText } from "../webphone-copy";

/**
 * The field vocabulary of the WebPhone screen.
 *
 * Every control here is the design system's `Field` wearing a design system Input:
 * one label position, one hint position (below the control), one error
 * position (below the hint, `role="alert"`, wired by `aria-describedby`), and
 * one focus ring. The screen is dense enough that a second arrangement of the
 * same three parts reads as a different kind of field when it is not.
 */

function errorText(code: string | undefined, lang: "ar" | "en") {
  return code ? webphoneFieldErrorText(code, lang) : undefined;
}

export function TextField({
  label,
  value,
  onChange,
  lang,
  disabled,
  error,
  maxLength,
  placeholder,
  help,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  lang: "ar" | "en";
  disabled: boolean;
  error?: string;
  maxLength: number;
  placeholder?: string;
  help?: string;
  inputMode?: "numeric" | "text";
}) {
  return (
    <Field label={label} hint={help} error={errorText(error, lang)}>
      {(field) => (
        <Input
          {...field}
          size="sm"
          type="text"
          dir="ltr"
          inputMode={inputMode}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder ?? `${label} *`}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="text-start"
        />
      )}
    </Field>
  );
}

/**
 * A value the server accepts but never gives back.
 *
 * Disabling it would be a lie — it is writable — so the distinction is carried
 * by two badges instead: one saying the value is write-only, one saying whether
 * something is stored. Both sit on the label row, next to the field they
 * describe, rather than in an action row further down where they read as a
 * property of the buttons.
 */
export function SecretField({
  label,
  value,
  onChange,
  lang,
  disabled,
  error,
  help,
  revealed,
  onToggleReveal,
  showLabel,
  hideLabel,
  writeOnlyLabel,
  storedLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  lang: "ar" | "en";
  disabled: boolean;
  error?: string;
  help: string;
  revealed: boolean;
  onToggleReveal: () => void;
  showLabel: string;
  hideLabel: string;
  writeOnlyLabel: string;
  storedLabel?: { text: string; stored: boolean };
}) {
  return (
    <Field
      label={label}
      hint={help}
      error={errorText(error, lang)}
      labelAction={
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral" className="gap-1">
            <KeyRound className="size-3" aria-hidden="true" />
            {writeOnlyLabel}
          </Badge>
          {storedLabel ? (
            <Badge tone={storedLabel.stored ? "success" : "neutral"}>
              {storedLabel.text}
            </Badge>
          ) : null}
        </span>
      }
    >
      {(field) => (
        <div className="relative">
          <Input
            {...field}
            size="sm"
            type={revealed ? "text" : "password"}
            dir="ltr"
            autoComplete="new-password"
            value={value}
            maxLength={1024}
            disabled={disabled}
            placeholder={storedLabel?.stored ? "••••••••••••" : `${label} *`}
            onChange={(event) => onChange(event.target.value)}
            className="pe-11 font-mono"
          />
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onToggleReveal}
            disabled={disabled}
            aria-label={revealed ? hideLabel : showLabel}
            aria-pressed={revealed}
            className="absolute end-1 top-1/2 -translate-y-1/2 px-1.5 text-muted-foreground"
          >
            {revealed ? (
              <EyeOff className="size-3.5" aria-hidden="true" />
            ) : (
              <Eye className="size-3.5" aria-hidden="true" />
            )}
          </Button>
        </div>
      )}
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  lang,
  disabled,
  error,
  help,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  lang: "ar" | "en";
  disabled: boolean;
  error?: string;
  help?: string;
}) {
  return (
    <Field label={label} hint={help} error={errorText(error, lang)}>
      {(field) => (
        <select
          {...field}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value as T)}
          className={cn(
            "h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs text-foreground",
            "outline-none transition-colors motion-reduce:transition-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            focusRing,
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/**
 * A switch and, underneath it, the one thing an operator cannot see: when the
 * change is written.
 *
 * `help` is where that sentence goes. This screen deliberately mixes two save
 * rules — a switch that persists on change, typed fields that persist on Save —
 * so neither may be left to be inferred from the presence or absence of a
 * nearby button.
 */
export function SwitchField({
  label,
  checked,
  onChange,
  disabled,
  help,
  status,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
  help?: string;
  status?: ReactNode;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-2.5">
      <span className="grid gap-0.5">
        <label htmlFor={id} className="text-xs font-medium">
          {label}
        </label>
        {help ? (
          <span id={helpId} className="text-xs leading-relaxed text-muted-foreground">
            {help}
          </span>
        ) : null}
        {status}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-describedby={help ? helpId : undefined}
        onChange={(event) => onChange(event.target.checked)}
        className={cn(
          "mt-0.5 size-4 shrink-0 accent-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          focusRing,
        )}
      />
    </div>
  );
}

/**
 * A labelled set of related controls.
 *
 * `role="group"` rather than a landmark: these are field groupings inside one
 * card, and promoting each to a region would bury the page's real landmarks
 * under a dozen identical ones.
 */
export function FieldGroup({
  title,
  help,
  action,
  children,
}: {
  title: string;
  help?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="grid min-w-0 gap-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <h4
            id={id}
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {title}
          </h4>
          {help ? (
            <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
              {help}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** The two-column grid every group's fields sit on. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-2.5 lg:grid-cols-2">{children}</div>;
}

export function SectionCard({
  title,
  help,
  icon,
  children,
  actions,
}: {
  title: string;
  help: string;
  icon: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:p-3.5 shadow-2xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold">
            {icon}
            {title}
          </h2>
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            {help}
          </p>
        </div>
        {actions}
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

/**
 * Loading, then success or error — for every write on the screen, in the same
 * place and the same shape. A save that only spins and then stops leaves the
 * operator to guess whether it landed.
 */
export function SaveStatus({
  pending,
  saved,
  savingLabel,
  savedLabel,
}: {
  pending: boolean;
  saved: boolean;
  savingLabel: string;
  savedLabel: string;
}) {
  if (!pending && !saved) return null;
  return (
    <p
      role="status"
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium",
        pending ? "text-muted-foreground" : "text-success-subtle-foreground",
      )}
    >
      {pending ? (
        <Loader2
          className="size-3.5 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <Check className="size-3.5" aria-hidden="true" />
      )}
      {pending ? savingLabel : savedLabel}
    </p>
  );
}

export function InlineError({
  code,
  details,
  lang,
  render,
}: {
  code: string | null;
  details: Record<string, string[]> | null;
  lang: "ar" | "en";
  render: (
    code: string,
    lang: "ar" | "en",
    details: Record<string, string[]> | null,
  ) => string;
}) {
  if (!code) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive bg-destructive-subtle p-2.5 text-xs font-medium text-destructive-subtle-foreground"
    >
      {render(code, lang, details)}
    </p>
  );
}

/**
 * The row that carries a card's own writes.
 *
 * `primary` and `destructive` are pushed to opposite ends with a divider above
 * them: Save and Delete sitting flush together is how a mis-click deletes a
 * server the operator meant to keep.
 */
export function ActionBar({
  primary,
  destructive,
  status,
}: {
  primary: ReactNode;
  destructive?: ReactNode;
  status?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-t border-border pt-2.5">
      <div className="flex flex-wrap items-center gap-2">{primary}</div>
      {status}
      {destructive ? <div className="ms-auto">{destructive}</div> : null}
    </div>
  );
}
