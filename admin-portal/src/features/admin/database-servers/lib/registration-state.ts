import type {
  CreateDatabaseServerDto,
  DatabaseServerConnectivityResult,
  DatabaseServerCredentialCheckName,
  DatabaseServerView,
} from "../types";

export function createDatabaseServerInitialValues(): CreateDatabaseServerDto {
  return {
    name: "",
    host: "",
    port: 5432,
    maxTenants: 100,
    securityAdminCredentials: { username: "", password: "" },
    sslMode: "disable",
    sslRejectUnauthorized: true,
    maintenanceDatabase: "postgres",
  };
}

const PRINCIPAL_LABELS: Record<DatabaseServerCredentialCheckName, string> = {
  securityAdmin: "Security admin",
};

export function credentialCheckLabel(
  principal: DatabaseServerCredentialCheckName,
): string {
  return PRINCIPAL_LABELS[principal];
}

export function failedCredentialChecks(
  result: DatabaseServerConnectivityResult,
) {
  return (result.checks ?? []).filter((check) => !check.connected);
}

export function needsActiveApplicationBindingBackfill(
  server: Pick<DatabaseServerView, "credentialBootstrap" | "systemPrincipals">,
  applicationBindingCount: number,
  bindingsSettled: boolean,
): boolean {
  return (
    bindingsSettled &&
    applicationBindingCount === 0 &&
    server.systemPrincipals.length === 2 &&
    server.systemPrincipals.every((binding) => binding.status === "READY") &&
    server.credentialBootstrap.status === "PENDING"
  );
}
