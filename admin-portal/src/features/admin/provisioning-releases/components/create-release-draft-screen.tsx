"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, FilePlus2, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useCreateReleaseDraft } from "../hooks/use-create-release-draft";
import { ReleaseDefinitionFields } from "./release-definition-form";
import { RELEASE_COPY, ReleaseMutationNotice, ReleasePageFrame, ReleaseSnapshotMeta, ReleaseStatePanel } from "./release-shared";

export function CreateReleaseDraftScreen() {
  const { lang, dir } = useI18n();
  const copy = RELEASE_COPY[lang];
  const creator = useCreateReleaseDraft();
  return <ReleasePageFrame dir={dir}><Link href="/provisioning/releases" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-cyan-700 dark:text-slate-300">{dir === "rtl" ? <ArrowRight className="size-4" /> : <ArrowLeft className="size-4" />}{copy.back}</Link>{creator.isAuthLoading ? <ReleaseStatePanel kind="loading" title={copy.loading} copy={copy} /> : !creator.permissions.canManageDrafts ? <ReleaseStatePanel kind="forbidden" title={copy.forbiddenManage} detail={copy.managePermission} copy={copy} /> : creator.created ? <section className="space-y-3"><div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"><h1 className="text-xl font-semibold">{copy.created}</h1><code dir="ltr" className="mt-3 block break-all text-start text-sm">{creator.created.data.draftId}</code><Link href={`/provisioning/releases/drafts/${creator.created.data.draftId}`} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white">{copy.open}</Link></div><ReleaseSnapshotMeta snapshot={creator.created} copy={copy} lang={lang} /></section> : <form aria-label={copy.createDraft} onSubmit={(event) => { event.preventDefault(); void creator.submit(); }} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><header><h1 className="text-xl font-semibold">{copy.createDraft}</h1><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{copy.disclosurePolicy}</p></header><ReleaseMutationNotice mutation={creator.mutation} copy={copy} /><ReleaseDefinitionFields value={creator.definition} errors={creator.errors} copy={copy} onChange={creator.update} disabled={creator.mutation.phase === "PENDING"} /><div className="flex justify-end border-t border-slate-200 pt-4 dark:border-slate-800"><button type="submit" disabled={creator.mutation.phase === "PENDING"} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-700 px-5 text-sm font-semibold text-white disabled:opacity-50">{creator.mutation.phase === "PENDING" ? <Loader2 className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />}{creator.mutation.phase === "PENDING" ? copy.creating : copy.create}</button></div></form>}</ReleasePageFrame>;
}
