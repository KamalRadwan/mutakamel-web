"use client";

import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Button, DataTable, type ColumnDef } from "@/design-system";
import { useReleaseIndex } from "../hooks/use-release-index";
import type { ProvisioningRelease, ReleaseDraft } from "../types/provisioning-releases";
import {
  formatDate,
  RELEASE_COPY,
  RefreshReleaseButton,
  ReleaseHero,
  ReleasePageFrame,
  ReleaseSnapshotMeta,
  ReleaseStatePanel,
  StatusBadge,
  type ReleaseCopy,
} from "./release-shared";

export function ReleaseIndexScreen() {
  const { lang, dir } = useI18n();
  const copy = RELEASE_COPY[lang];
  const index = useReleaseIndex();
  return (
    <ReleasePageFrame dir={dir}>
      <ReleaseHero
        copy={copy}
        action={
          <div className="flex flex-wrap gap-2">
            <RefreshReleaseButton label={copy.refresh} onClick={index.refresh} pending={index.isRefreshing} />
            {index.permissions.canManageDrafts ? (
              <Button asChild variant="primary">
                <Link href="/provisioning/releases/drafts/new">
                  <FilePlus2 className="size-4" aria-hidden="true" />
                  {copy.createDraft}
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />
      <IndexBody index={index} copy={copy} lang={lang} />
    </ReleasePageFrame>
  );
}

function IndexBody({ index, copy, lang }: { index: ReturnType<typeof useReleaseIndex>; copy: ReleaseCopy; lang: "ar" | "en" }) {
  if (index.state === "LOADING") return <ReleaseStatePanel kind="loading" title={copy.loading} copy={copy} />;
  if (index.state === "FORBIDDEN") return <ReleaseStatePanel kind="forbidden" title={copy.forbidden} detail={copy.readPermission} copy={copy} />;
  if (index.state === "UNAVAILABLE") {
    return (
      <ReleaseStatePanel
        kind="unavailable"
        title={copy.unavailable}
        detail={index.error?.message}
        correlationId={index.error?.correlationId}
        copy={copy}
        action={<RefreshReleaseButton label={copy.retry} onClick={index.refresh} />}
      />
    );
  }
  if (index.state === "ERROR" || !index.drafts || !index.releases) {
    return (
      <ReleaseStatePanel
        kind="error"
        title={copy.error}
        detail={index.error?.message}
        correlationId={index.error?.correlationId}
        copy={copy}
        action={<RefreshReleaseButton label={copy.retry} onClick={index.refresh} />}
      />
    );
  }
  if (index.state === "EMPTY") {
    return (
      <div className="space-y-3">
        <ReleaseStatePanel kind="empty" title={copy.empty} copy={copy} />
        <ReleaseSnapshotMeta snapshot={index.drafts} copy={copy} lang={lang} />
      </div>
    );
  }
  return (
    <div className="space-y-4" aria-busy={index.isRefreshing}>
      <DraftTable drafts={index.drafts.data} copy={copy} lang={lang} isRefreshing={index.isRefreshing} />
      <ReleaseTable releases={index.releases.data} copy={copy} lang={lang} isRefreshing={index.isRefreshing} />
      <div className="grid gap-3 xl:grid-cols-2">
        <ReleaseSnapshotMeta snapshot={index.drafts} copy={copy} lang={lang} />
        <ReleaseSnapshotMeta snapshot={index.releases} copy={copy} lang={lang} />
      </div>
    </div>
  );
}

function DraftTable({ drafts, copy, lang, isRefreshing }: { drafts: ReleaseDraft[]; copy: ReleaseCopy; lang: "ar" | "en"; isRefreshing: boolean }) {
  const columns: ColumnDef<ReleaseDraft>[] = [
    { key: "releaseVersion", headerEn: copy.releaseVersion, headerAr: copy.releaseVersion, cell: (row) => <span dir="ltr" className="font-mono text-xs">{row.releaseVersion}</span> },
    { key: "status", headerEn: copy.status, headerAr: copy.status, cell: (row) => <StatusBadge status={row.status} /> },
    { key: "componentId", headerEn: copy.componentId, headerAr: copy.componentId, cell: (row) => <span dir="ltr" className="font-mono text-xs">{row.componentId}</span> },
    { key: "manifestVersion", headerEn: copy.manifestVersion, headerAr: copy.manifestVersion, cell: (row) => <span dir="ltr" className="font-mono text-xs">{row.manifestVersion}</span> },
    { key: "revision", headerEn: copy.revision, headerAr: copy.revision, cell: (row) => <span dir="ltr" className="font-mono text-xs">{row.revision}</span> },
    { key: "updatedAt", headerEn: copy.updatedAt, headerAr: copy.updatedAt, cell: (row) => formatDate(row.updatedAt, lang) },
    {
      key: "open",
      headerEn: "",
      headerAr: "",
      align: "end",
      cell: (row) => (
        <Button asChild variant="outline" size="sm">
          <Link href={`/provisioning/releases/drafts/${row.draftId}`}>{copy.open}</Link>
        </Button>
      ),
    },
  ];
  return (
    <section aria-labelledby="release-drafts-title" className="space-y-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 id="release-drafts-title" className="font-semibold text-foreground">{copy.drafts}</h2>
        <span className="font-mono text-xs text-muted-foreground">{drafts.length}</span>
      </div>
      {drafts.length ? (
        <DataTable
          labelEn={RELEASE_COPY.en.drafts}
          labelAr={RELEASE_COPY.ar.drafts}
          columns={columns}
          data={drafts}
          isRefreshing={isRefreshing}
          getRowId={(row) => row.draftId}
          pagination={{ page: 1, limit: drafts.length || 1, totalItems: drafts.length, totalPages: 1, onPageChange: () => undefined }}
        />
      ) : (
        <p className="border-t border-border p-5 text-sm text-muted-foreground">{copy.noDrafts}</p>
      )}
    </section>
  );
}

function ReleaseTable({ releases, copy, lang, isRefreshing }: { releases: ProvisioningRelease[]; copy: ReleaseCopy; lang: "ar" | "en"; isRefreshing: boolean }) {
  const columns: ColumnDef<ProvisioningRelease>[] = [
    { key: "releaseVersion", headerEn: copy.releaseVersion, headerAr: copy.releaseVersion, cell: (row) => <span dir="ltr" className="font-mono text-xs">{row.releaseVersion}</span> },
    { key: "status", headerEn: copy.status, headerAr: copy.status, cell: (row) => <StatusBadge status={row.status} /> },
    { key: "componentId", headerEn: copy.componentId, headerAr: copy.componentId, cell: (row) => <span dir="ltr" className="font-mono text-xs">{row.componentId}</span> },
    { key: "manifestVersion", headerEn: copy.manifestVersion, headerAr: copy.manifestVersion, cell: (row) => <span dir="ltr" className="font-mono text-xs">{row.manifestVersion}</span> },
    { key: "publicationSource", headerEn: copy.publicationSource, headerAr: copy.publicationSource, cell: (row) => <span dir="ltr" className="font-mono text-xs">{row.publicationSource}</span> },
    { key: "publishedAt", headerEn: copy.publishedAt, headerAr: copy.publishedAt, cell: (row) => formatDate(row.publishedAt, lang) },
    {
      key: "open",
      headerEn: "",
      headerAr: "",
      align: "end",
      cell: (row) => (
        <Button asChild variant="outline" size="sm">
          <Link href={`/provisioning/releases/${row.releaseId}`}>{copy.open}</Link>
        </Button>
      ),
    },
  ];
  return (
    <section aria-labelledby="published-releases-title" className="space-y-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 id="published-releases-title" className="font-semibold text-foreground">{copy.releases}</h2>
        <span className="font-mono text-xs text-muted-foreground">{releases.length}</span>
      </div>
      {releases.length ? (
        <DataTable
          labelEn={RELEASE_COPY.en.releases}
          labelAr={RELEASE_COPY.ar.releases}
          columns={columns}
          data={releases}
          isRefreshing={isRefreshing}
          getRowId={(row) => row.releaseId}
          pagination={{ page: 1, limit: releases.length || 1, totalItems: releases.length, totalPages: 1, onPageChange: () => undefined }}
        />
      ) : (
        <p className="border-t border-border p-5 text-sm text-muted-foreground">{copy.noReleases}</p>
      )}
    </section>
  );
}
