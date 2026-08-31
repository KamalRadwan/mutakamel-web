"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, FilePlus2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Button, Card, CardContent } from "@/design-system";
import { useCreateReleaseDraft } from "../hooks/use-create-release-draft";
import { ReleaseDefinitionFields } from "./release-definition-form";
import { RELEASE_COPY, ReleaseMutationNotice, ReleasePageFrame, ReleaseSnapshotMeta, ReleaseStatePanel } from "./release-shared";

export function CreateReleaseDraftScreen() {
  const { lang, dir } = useI18n();
  const copy = RELEASE_COPY[lang];
  const creator = useCreateReleaseDraft();
  return (
    <ReleasePageFrame dir={dir}>
      <Button asChild variant="ghost" className="w-fit">
        <Link href="/provisioning/releases">
          {dir === "rtl" ? <ArrowRight className="size-4" aria-hidden="true" /> : <ArrowLeft className="size-4" aria-hidden="true" />}
          {copy.back}
        </Link>
      </Button>

      {creator.isAuthLoading ? (
        <ReleaseStatePanel kind="loading" title={copy.loading} copy={copy} />
      ) : !creator.permissions.canManageDrafts ? (
        <ReleaseStatePanel kind="forbidden" title={copy.forbiddenManage} detail={copy.managePermission} copy={copy} />
      ) : creator.created ? (
        <section className="space-y-3">
          <Card className="border-success/30 bg-success-subtle p-6 text-success-subtle-foreground">
            <div role="status">
              <h1 className="text-xl font-semibold">{copy.created}</h1>
              <code dir="ltr" className="mt-3 block break-all text-start text-sm">{creator.created.data.draftId}</code>
              <Button asChild variant="primary" className="mt-4">
                <Link href={`/provisioning/releases/drafts/${creator.created.data.draftId}`}>{copy.open}</Link>
              </Button>
            </div>
          </Card>
          <ReleaseSnapshotMeta snapshot={creator.created} copy={copy} lang={lang} />
        </section>
      ) : (
        <Card>
          <form
            aria-label={copy.createDraft}
            onSubmit={(event) => {
              event.preventDefault();
              void creator.submit();
            }}
          >
            <CardContent className="space-y-4">
              <header>
                <h1 className="text-xl font-semibold text-foreground">{copy.createDraft}</h1>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.disclosurePolicy}</p>
              </header>
              <ReleaseMutationNotice mutation={creator.mutation} copy={copy} />
              <ReleaseDefinitionFields value={creator.definition} errors={creator.errors} copy={copy} onChange={creator.update} disabled={creator.mutation.phase === "PENDING"} />
              <div className="flex justify-end border-t border-border pt-4">
                <Button type="submit" variant="primary" disabled={creator.mutation.phase === "PENDING"} loading={creator.mutation.phase === "PENDING"}>
                  <FilePlus2 className="size-4" aria-hidden="true" />
                  {creator.mutation.phase === "PENDING" ? copy.creating : copy.create}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      )}
    </ReleasePageFrame>
  );
}
