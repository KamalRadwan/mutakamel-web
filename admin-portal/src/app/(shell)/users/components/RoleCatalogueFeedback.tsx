import { Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { RoleCatalogueStatus } from "../hooks/useAdminRoleCatalogue";

export function RoleCatalogueFeedback({ status, empty, onRetry, assignable = false }: {
  status: RoleCatalogueStatus;
  empty: boolean;
  onRetry: () => void;
  assignable?: boolean;
}) {
  const { t } = useI18n();
  if (status === "success" && !empty) return null;
  const failed = status === "error" || status === "forbidden";
  const message = status === "unavailable" ? (assignable ? t.users.assignableRolesPrerequisite : t.users.rolesUnavailable)
    : status === "loading" ? t.users.rolesLoading
    : status === "forbidden" ? (assignable ? t.users.assignableRolesForbidden : t.users.rolesUnavailable)
    : status === "success" ? (assignable ? t.users.assignableRolesEmpty : t.users.rolesEmpty)
    : status === "error" ? t.users.rolesLoadFailed : t.users.rolesEmpty;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground" role={failed ? "alert" : "status"}>
      <span>{message}</span>
      {failed && <Button type="button" variant="outline" size="sm" onClick={onRetry}>{t.common.retry}</Button>}
    </div>
  );
}
