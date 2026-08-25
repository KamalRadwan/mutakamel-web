"use client";

import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useReleaseIndex } from "../hooks/use-release-index";
import type { ProvisioningRelease, ReleaseDraft } from "../types/provisioning-releases";
import { formatDate, RELEASE_COPY, RefreshReleaseButton, ReleaseHero, ReleasePageFrame, ReleaseSnapshotMeta, ReleaseStatePanel, StatusBadge, type ReleaseCopy } from "./release-shared";

export function ReleaseIndexScreen() {
  const { lang, dir } = useI18n();
  const copy = RELEASE_COPY[lang];
  const index = useReleaseIndex();
  return <ReleasePageFrame dir={dir}><ReleaseHero copy={copy} action={<div className="flex flex-wrap gap-2"><RefreshReleaseButton label={copy.refresh} onClick={index.refresh} pending={index.isRefreshing} />{index.permissions.canManageDrafts ? <Link href="/provisioning/releases/drafts/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-cyan-950"><FilePlus2 className="size-4" />{copy.createDraft}</Link> : null}</div>} /><IndexBody index={index} copy={copy} lang={lang} /></ReleasePageFrame>;
}

function IndexBody({ index, copy, lang }: { index: ReturnType<typeof useReleaseIndex>; copy: ReleaseCopy; lang: "ar" | "en" }) {
  if (index.state === "LOADING") return <ReleaseStatePanel kind="loading" title={copy.loading} copy={copy} />;
  if (index.state === "FORBIDDEN") return <ReleaseStatePanel kind="forbidden" title={copy.forbidden} detail={copy.readPermission} copy={copy} />;
  if (index.state === "UNAVAILABLE") return <ReleaseStatePanel kind="unavailable" title={copy.unavailable} detail={index.error?.message} correlationId={index.error?.correlationId} copy={copy} action={<RefreshReleaseButton label={copy.retry} onClick={index.refresh} />} />;
  if (index.state === "ERROR" || !index.drafts || !index.releases) return <ReleaseStatePanel kind="error" title={copy.error} detail={index.error?.message} correlationId={index.error?.correlationId} copy={copy} action={<RefreshReleaseButton label={copy.retry} onClick={index.refresh} />} />;
  if (index.state === "EMPTY") return <div className="space-y-3"><ReleaseStatePanel kind="empty" title={copy.empty} copy={copy} /><ReleaseSnapshotMeta snapshot={index.drafts} copy={copy} lang={lang} /></div>;
  return <div className="space-y-4" aria-busy={index.isRefreshing}><DraftTable drafts={index.drafts.data} copy={copy} lang={lang} /><ReleaseTable releases={index.releases.data} copy={copy} lang={lang} /><div className="grid gap-3 xl:grid-cols-2"><ReleaseSnapshotMeta snapshot={index.drafts} copy={copy} lang={lang} /><ReleaseSnapshotMeta snapshot={index.releases} copy={copy} lang={lang} /></div></div>;
}

function DraftTable({ drafts, copy, lang }: { drafts: ReleaseDraft[]; copy: ReleaseCopy; lang: "ar" | "en" }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><header className="flex items-center justify-between px-4 py-3"><h2 className="font-black">{copy.drafts}</h2><span className="font-mono text-xs text-slate-500">{drafts.length}</span></header>{drafts.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead className="bg-slate-100 text-xs font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300"><tr><Header>{copy.releaseVersion}</Header><Header>{copy.status}</Header><Header>{copy.componentId}</Header><Header>{copy.manifestVersion}</Header><Header>{copy.revision}</Header><Header>{copy.updatedAt}</Header><Header>{copy.open}</Header></tr></thead><tbody>{drafts.map((draft) => <tr key={draft.draftId} className="border-t border-slate-200 dark:border-slate-800"><Cell mono>{draft.releaseVersion}</Cell><Cell><StatusBadge status={draft.status} /></Cell><Cell mono>{draft.componentId}</Cell><Cell mono>{String(draft.manifestVersion)}</Cell><Cell mono>{String(draft.revision)}</Cell><Cell>{formatDate(draft.updatedAt, lang)}</Cell><Cell><Link href={`/provisioning/releases/drafts/${draft.draftId}`} className="inline-flex min-h-10 items-center rounded-xl border border-cyan-300 px-3 font-bold text-cyan-800 dark:border-cyan-800 dark:text-cyan-200">{copy.open}</Link></Cell></tr>)}</tbody></table></div> : <p className="border-t border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-800">{copy.noDrafts}</p>}</section>;
}

function ReleaseTable({ releases, copy, lang }: { releases: ProvisioningRelease[]; copy: ReleaseCopy; lang: "ar" | "en" }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><header className="flex items-center justify-between px-4 py-3"><h2 className="font-black">{copy.releases}</h2><span className="font-mono text-xs text-slate-500">{releases.length}</span></header>{releases.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead className="bg-slate-100 text-xs font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300"><tr><Header>{copy.releaseVersion}</Header><Header>{copy.status}</Header><Header>{copy.componentId}</Header><Header>{copy.manifestVersion}</Header><Header>{copy.publicationSource}</Header><Header>{copy.publishedAt}</Header><Header>{copy.open}</Header></tr></thead><tbody>{releases.map((release) => <tr key={release.releaseId} className="border-t border-slate-200 dark:border-slate-800"><Cell mono>{release.releaseVersion}</Cell><Cell><StatusBadge status={release.status} /></Cell><Cell mono>{release.componentId}</Cell><Cell mono>{String(release.manifestVersion)}</Cell><Cell mono>{release.publicationSource}</Cell><Cell>{formatDate(release.publishedAt, lang)}</Cell><Cell><Link href={`/provisioning/releases/${release.releaseId}`} className="inline-flex min-h-10 items-center rounded-xl border border-cyan-300 px-3 font-bold text-cyan-800 dark:border-cyan-800 dark:text-cyan-200">{copy.open}</Link></Cell></tr>)}</tbody></table></div> : <p className="border-t border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-800">{copy.noReleases}</p>}</section>;
}

function Header({ children }: { children: React.ReactNode }) { return <th scope="col" className="px-4 py-3 text-start">{children}</th>; }
function Cell({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) { return <td dir={mono ? "ltr" : undefined} className={`px-4 py-3 text-start ${mono ? "font-mono text-xs" : ""}`}>{children}</td>; }
