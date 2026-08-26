import { Shield, Lock, FileKey, CheckCircle2, AlertTriangle } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
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
        return "Connects via plain text first; switches to SSL if forced by host.";
      case "prefer":
        return "Tries SSL connection first; falls back to unencrypted if unsupported.";
      case "require":
        return "Requires encrypted connection without validating host certificate authority.";
      case "verify-ca":
        return "Enforces TLS encryption and validates the database server Certificate Authority (CA).";
      case "verify-full":
        return "Enforces TLS encryption, validates Certificate Authority, and verifies hostname match.";
      default:
        return "Standard TLS Transport Encryption configuration.";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SSL / TLS Encryption Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Shield className="w-4 h-4 text-purple-500" />
            {d.title}
          </h3>

          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/60">
              <div className="text-2xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                {d.modeLabel}
              </div>
              <div className="text-xl font-semibold font-mono text-purple-700 dark:text-purple-300 mt-1 uppercase">
                {server.sslMode}
              </div>
              <p className="mt-2 text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                {getSslModeHelp(server.sslMode)}
              </p>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-500 font-medium">{d.certStatus}</span>
              <span className="font-semibold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                {server.hasSslConfig ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    {d.certConfigured}
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    No custom bundle attached
                  </>
                )}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-500 font-medium">{d.verification}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                {server.sslRejectUnauthorized ? d.strictVerification : d.relaxedVerification}
              </span>
            </div>
          </div>
        </div>

        {/* Encrypted Credential Boundary Callout */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Lock className="w-4 h-4 text-blue-500" />
              {d.encryptedBoundaryTitle}
            </h3>

            <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {d.encryptedBoundaryDesc}
            </p>

            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <FileKey className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  Zero plain-text password persistence in browser storage or telemetry logs.
                </span>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <Shield className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  Isolated service credentials (`mutakamel_provisioner`, application DB keys).
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200">
            Audit logging records all password rotation events with cryptographically generated receipts.
          </div>
        </div>
      </div>
    </div>
  );
}
