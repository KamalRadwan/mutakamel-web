"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { CreateDatabaseServerWizard } from "@/features/admin/database-servers/components/CreateDatabaseServerWizard";
import { useAuth } from "@/context/AuthContext";
import { adminCanAll } from "@/lib/auth/rbac";

export default function NewDatabaseServerPage() {
  const { user } = useAuth();
  const canCreate = adminCanAll(user, ["admin.database_servers.create"]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        <Link
          href="/database-servers"
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
        >
          <ArrowLeft className="w-4 h-4 me-1" />
          Back to Servers
        </Link>

        {canCreate ? (
          <CreateDatabaseServerWizard />
        ) : (
          <section
            role="alert"
            className="mx-auto flex min-h-72 max-w-3xl flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <ShieldAlert className="h-10 w-10" aria-hidden="true" />
            <h1 className="mt-4 text-lg font-bold">Database Server registration is unavailable</h1>
            <p className="mt-2 max-w-md text-sm leading-6">
              Permission <code>admin.database_servers.create</code> is required to register a Database Server.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
