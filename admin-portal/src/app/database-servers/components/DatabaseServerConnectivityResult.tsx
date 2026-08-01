"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { DatabaseServerConnectivityResult as ConnectivityResult } from "@/types/database-server";

const principalLabels = {
  primary: "قاعدة البيانات الرئيسية",
  provisioning: "Provisioning",
  backup: "Backup",
  coreApp: "Core App",
  crmApp: "CRM App",
  tradeApp: "Trade App",
  workerApp: "Worker App",
} as const;

export function DatabaseServerConnectivityResult({
  result,
  lang,
}: {
  result: ConnectivityResult;
  lang: "ar" | "en";
}) {
  return (
    <div
      className={`p-4 text-xs font-semibold rounded-2xl border flex items-start gap-3 animate-in fade-in ${
        result.connected
          ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
          : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800"
      }`}
    >
      {result.connected ? (
        <CheckCircle2 className="w-5 h-5 shrink-0" />
      ) : (
        <AlertCircle className="w-5 h-5 shrink-0" />
      )}
      <div className="min-w-0 space-y-2">
        <p>{result.message}</p>
        {result.checks && result.checks.length > 0 && (
          <ul className="space-y-1.5 font-medium">
            {result.checks.map((check) => (
              <li key={check.principal} className="flex items-start gap-2">
                <span aria-hidden>{check.connected ? "✓" : "×"}</span>
                <span className="font-semibold">
                  {lang === "ar" ? principalLabels[check.principal] : check.principal}
                </span>
                {!check.connected && <span>— {check.message}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
