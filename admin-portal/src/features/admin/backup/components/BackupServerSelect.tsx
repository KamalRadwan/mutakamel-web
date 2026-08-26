import { Field, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/design-system";
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
    <Field label={label}>
      {(fieldProps) => (
        <Select value={value} onValueChange={onChange} disabled={disabled}>
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
