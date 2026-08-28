"use client";

import React, { useId } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({
  label,
  error,
  className = "",
  "aria-describedby": describedBy,
  ...props
}: InputProps) {
  // The label is associated with the control rather than merely sitting above
  // it, so a screen reader announces the field's name and its error. A caller
  // that describes the field further is merged in rather than overridden.
  const generatedId = useId();
  const inputId = props.id ?? generatedId;
  const errorId = `${inputId}-error`;
  const description =
    [describedBy, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-bold text-slate-700 dark:text-slate-300 block text-start"
        >
          {label}
        </label>
      )}
      <input
        {...props}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={description}
        className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all ${className}`}
      />
      {error && (
        <p id={errorId} role="alert" className="text-[11px] font-semibold text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
