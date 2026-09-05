"use client";

import { forwardRef, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  cn,
  type InputProps,
} from "@/design-system";
import { webphoneFieldErrorText } from "../webphone-copy";

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
    <Field
      label={label}
      hint={help}
      error={error ? webphoneFieldErrorText(error, lang) : undefined}
    >
      {/* SIP domains, URIs and extension numbers are Latin technical values
          that stay left-to-right inside an Arabic page. */}
      <Input
        dir="ltr"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
      />
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
    <Field
      label={label}
      hint={help}
      error={error ? webphoneFieldErrorText(error, lang) : undefined}
    >
      {/* Direction comes from the app-wide DirectionProvider in
          src/i18n/DirectionBridge.tsx, so no screen branches on `dir`. */}
      <Select value={value} onValueChange={(next) => onChange(next as T)} disabled={disabled}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

interface SecretInputProps extends InputProps {
  revealed: boolean;
  onToggleReveal: () => void;
  showLabel: string;
  hideLabel: string;
}

/**
 * The input half of a write-only secret, with its reveal toggle.
 *
 * Split out so `Field` still clones a single control and keeps `htmlFor`
 * pointing at the real `<input>`: the toggle is a sibling inside this
 * component rather than a second child of the field.
 */
const SecretInput = forwardRef<HTMLInputElement, SecretInputProps>(
  ({ revealed, onToggleReveal, showLabel, hideLabel, disabled, className, ...props }, ref) => (
    <div className="relative">
      <Input
        ref={ref}
        dir="ltr"
        autoComplete="new-password"
        type={revealed ? "text" : "password"}
        disabled={disabled}
        className={cn("font-mono pe-9", className)}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onToggleReveal}
        disabled={disabled}
        aria-label={revealed ? hideLabel : showLabel}
        aria-pressed={revealed}
        className="absolute inset-y-0 end-0 px-2"
      >
        {revealed ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </Button>
    </div>
  ),
);
SecretInput.displayName = "SecretInput";

/**
 * A write-only credential.
 *
 * Never pre-filled — the stored value is encrypted and never returned — and a
 * blank submission keeps whatever is stored rather than clearing it. The
 * `help` line is what says so.
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
}) {
  return (
    <Field
      label={label}
      hint={help}
      error={error ? webphoneFieldErrorText(error, lang) : undefined}
    >
      <SecretInput
        value={value}
        maxLength={1024}
        disabled={disabled}
        revealed={revealed}
        onToggleReveal={onToggleReveal}
        showLabel={showLabel}
        hideLabel={hideLabel}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function SwitchField({
  label,
  checked,
  onChange,
  disabled,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
  help?: string;
}) {
  return (
    <Field label={label} hint={help}>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </Field>
  );
}

export function SectionCard({
  title,
  help,
  icon,
  describedBy,
  children,
  actions,
}: {
  title: string;
  help: string;
  icon: ReactNode;
  /** Points at the unavailable notice so the reason reaches assistive tech. */
  describedBy?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card role="region" aria-label={title} aria-describedby={describedBy} className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium text-card-foreground">
            {icon}
            {title}
          </h2>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">{help}</p>
        </div>
        {actions}
      </div>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </Card>
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
      className="rounded-sm border border-destructive px-3 py-2 text-xs text-destructive"
    >
      {render(code, lang, details)}
    </p>
  );
}

export function StateBadge({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <Badge tone={active ? "positive" : "neutral"}>
      {active ? activeLabel : inactiveLabel}
    </Badge>
  );
}
