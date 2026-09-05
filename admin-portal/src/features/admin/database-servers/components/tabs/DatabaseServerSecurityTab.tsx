import { Shield, Lock, FileKey, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Card } from "@/design-system";
import type { DatabaseServerView } from "../../types";

interface DatabaseServerSecurityTabProps {
  server: DatabaseServerView;
}

export function DatabaseServerSecurityTab({ server }: DatabaseServerSecurityTabProps) {
  const { t } = useI18n();
  const d = t.databaseServerDetail.security;
  const modeSurface = server.sslMode === "disable"
    ? "border-warning/30 bg-warning-subtle text-warning-subtle-foreground"
    : "border-info/30 bg-info-subtle text-info-subtle-foreground";

  const getSslModeHelp = (mode: string) => {
    switch (mode) {
      case "disable":
        return d.tlsDisabled;
      case "allow":
        return d.sslModeHelp.allow;
      case "prefer":
        return d.sslModeHelp.prefer;
      case "require":
        return d.sslModeHelp.require;
      case "verify-ca":
        return d.sslModeHelp.verifyCa;
      case "verify-full":
        return d.sslModeHelp.verifyFull;
      default:
        return d.sslModeHelp.fallback;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold text-foreground">
            <Shield className="size-4 text-info" aria-hidden="true" />
            {d.title}
          </h3>
          <div className="mt-4 space-y-4 text-xs">
            <div className={`rounded-lg border p-4 ${modeSurface}`}>
              <div className="text-xs font-semibold uppercase tracking-wider rtl:normal-case rtl:tracking-normal">
                {d.modeLabel}
              </div>
              <div className="mt-1 font-mono text-xl font-semibold uppercase">
                {server.sslMode}
              </div>
              <p className="mt-2 font-medium leading-relaxed text-foreground">{getSslModeHelp(server.sslMode)}</p>
            </div>

            <div className="flex justify-between border-b border-border py-2">
              <span className="font-medium text-muted-foreground">{d.certStatus}</span>
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                {server.hasSslConfig ? (
                  <>
                    <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                    {d.certConfigured}
                  </>
                ) : (
                  <>
                    <FileKey className="size-4 text-muted-foreground" aria-hidden="true" />
                    {d.noCustomBundle}
                  </>
                )}
              </span>
            </div>

            <div className="flex justify-between border-b border-border py-2">
              <span className="font-medium text-muted-foreground">{d.verification}</span>
              <span className="font-mono font-semibold text-foreground">
                {/*
                  UI-003. sslRejectUnauthorized was read on its own, so a server
                  with sslMode "disable" still reported "Strict Verification" -
                  naming a protection that cannot be operating, because there is
                  no certificate to verify when TLS is off. The stored flag is
                  unchanged and still applies the moment TLS is turned on; what
                  it does not do is describe the connection today.
                */}
                {server.sslMode === "disable"
                  ? d.verificationNotApplicable
                  : server.sslRejectUnauthorized
                    ? d.strictVerification
                    : d.relaxedVerification}
              </span>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col justify-between p-6">
          <div>
            <h3 className="flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold text-foreground">
              <Lock className="size-4 text-info" aria-hidden="true" />
              {d.encryptedBoundaryTitle}
            </h3>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{d.encryptedBoundaryDesc}</p>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted p-3">
                <FileKey className="size-4 shrink-0 text-info" aria-hidden="true" />
                <span className="font-medium text-foreground">{d.passwordBoundaryNote}</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted p-3">
                <Shield className="size-4 shrink-0 text-info" aria-hidden="true" />
                <span className="font-medium text-foreground">{d.isolatedCredentialsNote}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-info/30 bg-info-subtle p-3 text-xs text-info-subtle-foreground">
            {d.auditLoggingNote}
          </div>
        </Card>
      </div>
    </div>
  );
}
