"use client";

import { useId, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
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
  const helpId = useId();
  return (
    <div className="space-y-1">
      <Input
        label={label}
        dir="ltr"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
        aria-describedby={help ? helpId : undefined}
        error={error ? webphoneFieldErrorText(error, lang) : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {help ? (
        <p id={helpId} className="text-[11px] text-slate-500 dark:text-slate-400">
          {help}
        </p>
      ) : null}
    </div>
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
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  lang: "ar" | "en";
  disabled: boolean;
  error?: string;
}) {
  return (
    <Select
      label={label}
      value={value}
      disabled={disabled}
      options={options.map((option) => ({
        value: option.value,
        label: option.label,
      }))}
      error={error ? webphoneFieldErrorText(error, lang) : undefined}
      onChange={(event) => onChange(event.target.value as T)}
    />
  );
}

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
  const helpId = useId();
  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          label={label}
          type={revealed ? "text" : "password"}
          dir="ltr"
          autoComplete="new-password"
          value={value}
          maxLength={1024}
          disabled={disabled}
          className="font-mono pe-11"
          aria-describedby={helpId}
          error={error ? webphoneFieldErrorText(error, lang) : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          onClick={onToggleReveal}
          disabled={disabled}
          aria-label={revealed ? hideLabel : showLabel}
          aria-pressed={revealed}
          className="absolute end-2 top-[26px] text-slate-500 disabled:opacity-40"
        >
          {revealed ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
      <p id={helpId} className="text-[11px] text-slate-500 dark:text-slate-400">
        {help}
      </p>
    </div>
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
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 dark:border-slate-800 dark:bg-slate-950">
      <span>
        <label htmlFor={id} className="block text-xs font-bold">
          {label}
        </label>
        {help ? (
          <span
            id={helpId}
            className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400"
          >
            {help}
          </span>
        ) : null}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-describedby={help ? helpId : undefined}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 shrink-0 accent-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
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
    <section
      aria-label={title}
      aria-describedby={describedBy}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            {icon}
            {title}
          </h2>
          <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500 dark:text-slate-400">
            {help}
          </p>
        </div>
        {actions}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
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
      className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
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
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
          : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}
