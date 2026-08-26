import type { BackupDatabaseServerOption } from "../types";

interface BackupServerSelectProps {
  label: string;
  value: string;
  servers: BackupDatabaseServerOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function BackupServerSelect({
  label,
  value,
  servers,
  onChange,
  disabled,
  placeholder = "Select a database server",
}: BackupServerSelectProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      >
        <option value="">{placeholder}</option>
        {servers.map((server) => (
          <option key={server.id} value={server.id}>
            {server.name} · {server.status}
          </option>
        ))}
      </select>
    </label>
  );
}
