import { Shield, Lock, FileKey, CheckCircle2, AlertTriangle } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Card } from "@/design-system";
import type { DatabaseServerView } from "../../types";

interface DatabaseServerSecurityTabProps {
  server: DatabaseServerView;
}

export function DatabaseServerSecurityTab({ server }: DatabaseServerSecurityTabProps) {
  const { t } = useI18n();
  const d = t.databaseServerDetail.security;

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
            <Shield className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            {d.title}
          </h3>
          <div className="mt-4 space-y-4 text-xs">
            <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-4 dark:bg-brand-500/10">
              <div className="text-2xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">
                {d.modeLabel}
              </div>
              <div className="mt-1 font-mono text-xl font-semibold uppercase text-brand-700 dark:text-brand-400">
                {server.sslMode}
              </div>
              <p className="mt-2 font-medium leading-relaxed text-foreground">{getSslModeHelp(server.sslMode)}</p>
            </div>

            <div className="flex justify-between border-b border-border py-2">
              <span className="font-medium text-muted-foreground">{d.certStatus}</span>
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                {server.hasSslConfig ? (
                  <>
                    <CheckCircle2 className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                    {d.certConfigured}
                  </>
                ) : (
                  <>
                    <AlertTriangle className="size-4 text-warn-600 dark:text-warn-400" aria-hidden="true" />
                    {d.noCustomBundle}
                  </>
                )}
              </span>
            </div>

            <div className="flex justify-between border-b border-border py-2">
              <span className="font-medium text-muted-foreground">{d.verification}</span>
              <span className="font-mono font-semibold text-foreground">
                {server.sslRejectUnauthorized ? d.strictVerification : d.relaxedVerification}
              </span>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col justify-between p-6">
          <div>
            <h3 className="flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold text-foreground">
              <Lock className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              {d.encryptedBoundaryTitle}
            </h3>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{d.encryptedBoundaryDesc}</p>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted p-3">
                <FileKey className="size-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                <span className="font-medium text-foreground">{d.passwordBoundaryNote}</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted p-3">
                <Shield className="size-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                <span className="font-medium text-foreground">{d.isolatedCredentialsNote}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-brand-500/30 bg-brand-500/5 p-3 text-xs text-foreground dark:bg-brand-500/10">
            {d.auditLoggingNote}
          </div>
        </Card>
      </div>
    </div>
  );
}
