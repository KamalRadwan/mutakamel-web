import { Field, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { BackupDatabaseServerOption } from "../types";

interface BackupServerSelectProps {
  label: string;
  value: string;
  servers: BackupDatabaseServerOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
}

export function BackupServerSelect({
  label,
  value,
  servers,
  onChange,
  disabled,
  placeholder = "Select a database server",
  required = false,
}: BackupServerSelectProps) {
  const { dir } = useI18n();
  return (
    <Field label={label} required={required}>
      {(fieldProps) => (
        <Select value={value} onValueChange={onChange} disabled={disabled} dir={dir}>
          <SelectTrigger {...fieldProps}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {servers.map((server) => (
              <SelectItem key={server.id} value={server.id}>
                {server.name} · {server.status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}
