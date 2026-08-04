"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { ArrowLeft } from "lucide-react";
import { CreateDatabaseServerWizard } from "@/features/admin/database-servers/components/CreateDatabaseServerWizard";

export default function NewDatabaseServerPage() {
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

        <CreateDatabaseServerWizard />
      </main>
    </div>
  );
}
