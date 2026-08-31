"use client";

import { useId, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { webphoneFieldErrorText } from "../webphone-copy";

export function FieldError({
  id,
  code,
  lang,
}: {
  id: string;
  code?: string;
  lang: "ar" | "en";
}) {
  if (!code) return null;
  return (
    <p id={id} role="alert" className="text-xs font-bold text-rose-700 dark:text-rose-300">
      {webphoneFieldErrorText(code, lang)}
    </p>
  );
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
  const id = useId();
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-xs font-bold">
        {label}
      </label>
      <input
        id={id}
        type="text"
        dir="ltr"
        inputMode={inputMode}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={
          [error ? errorId : null, help ? helpId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm text-start outline-none focus:border-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
      />
      {help ? (
        <p id={helpId} className="text-xs text-slate-500 dark:text-slate-400">
          {help}
        </p>
      ) : null}
      <FieldError id={errorId} code={error} lang={lang} />
    </div>
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
  const id = useId();
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-xs font-bold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={revealed ? "text" : "password"}
          dir="ltr"
          autoComplete="new-password"
          value={value}
          maxLength={1024}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pe-11 ps-3 font-mono text-sm outline-none focus:border-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
        />
        <button
          type="button"
          onClick={onToggleReveal}
          disabled={disabled}
          aria-label={revealed ? hideLabel : showLabel}
          aria-pressed={revealed}
          className="absolute end-3 top-3 text-slate-500 disabled:opacity-40"
        >
          {revealed ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
      <p id={helpId} className="text-xs text-slate-500 dark:text-slate-400">
        {help}
      </p>
      <FieldError id={errorId} code={error} lang={lang} />
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
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-xs font-bold">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value as T)}
        className="min-h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm outline-none focus:border-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError id={errorId} code={error} lang={lang} />
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
    <div className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 dark:border-slate-700 dark:bg-slate-950">
      <span>
        <label htmlFor={id} className="block text-sm font-bold">
          {label}
        </label>
        {help ? (
          <span
            id={helpId}
            className="mt-1 block text-xs text-slate-500 dark:text-slate-400"
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
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black">
            {icon}
            {title}
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
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
      className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-bold text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
    >
      {render(code, lang, details)}
    </p>
  );
}
