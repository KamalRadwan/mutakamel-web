"use client";

import { Globe, Plus, RefreshCw, Search } from "lucide-react";
import { Badge, Button, ConfirmActionModal, DegradedBanner, ErrorState, Input, PageActions, PageHeader, PermissionGate, Skeleton,
  Tabs, TabsContent, TabsList, TabsTrigger } from "@/design-system";
import { formatNumber } from "@/lib/format/number";
import { useI18n } from "@/i18n/I18nContext";
import { CreateCrmCustomFieldsModal } from "./components/CreateCrmCustomFieldsModal";
import { CustomFieldRequirementsDrawer } from "./components/CustomFieldRequirementsDrawer";
import { CustomFieldEditDrawer } from "./components/CustomFieldEditDrawer";
import { CustomFieldValuesPanel } from "./components/CustomFieldValuesPanel";
import { CustomFieldDefinitions } from "./components/CustomFieldDefinitions";
import { useCustomFieldsPage, useCustomFieldsSessionKey } from "./hooks/useCustomFieldsPage";

export default function CrmCustomFieldsPage() {
  const sessionKey = useCustomFieldsSessionKey();
  return <CustomFieldsWorkspace key={sessionKey} />;
}

function CustomFieldsWorkspace() {
  const screen = useCustomFieldsPage();
  const { lang } = useI18n();
  const { t } = screen;
  const guard = screen.recordValues.guard;
  return (
    <PermissionGate require="crm.custom_fields.read" denied={screen.error?.status === 403}>
      <div className="flex min-w-0 flex-col gap-3" aria-busy={screen.isLoading || screen.busy || undefined}>
        <PageHeader title={t.nav.customFields} description={t.crmCustomFields.managementSubtitle}
          primaryAction={screen.tab === "definitions" && screen.canManage ? {
            label: t.crmCustomFields.addTitle, icon: <Plus className="size-4" aria-hidden="true" />,
            onClick: screen.openCreate, disabled: !screen.canCreate } : undefined}
          secondaryActions={<Button size="sm" variant="outline" onClick={screen.reloadPage}
            loading={screen.isLoading || screen.recordValues.values.isLoading} disabled={screen.busy}>
            <RefreshCw className="size-4" aria-hidden="true" />{t.crmCustomFields.reload}</Button>} />
        {screen.tab === "definitions" && <PageActions slot="search">
          <div className="relative w-full min-w-40 max-w-72">
            <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-4 text-muted-foreground" aria-hidden="true" />
            <Input ref={(element) => screen.dialogFocus.setFallbackElement(element)} size="sm" className="ps-8" value={screen.searchQuery} onChange={(event) => screen.setSearchQuery(event.target.value)}
              aria-label={t.crmCustomFields.search} placeholder={t.crmCustomFields.search} />
          </div>
        </PageActions>}
        {!screen.canManage ? <DegradedBanner message={t.crmCustomFields.readOnly} /> : null}
        {screen.atCapacity && screen.tab === "definitions" ? <DegradedBanner message={t.crmCustomFields.limitReached} /> : null}
        {screen.hasLoaded && screen.error ? <DegradedBanner message={t.crmCustomFields.refreshKept} /> : null}
        {screen.editor.error && !screen.editor.selected ? <DegradedBanner message={screen.editor.error} /> : null}
        {screen.createError && !screen.isCreateOpen ? <DegradedBanner message={screen.createError} /> : null}
        <Tabs value={screen.tab} onValueChange={screen.selectTab}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border">
            <TabsList aria-label={t.nav.customFields}>
              <TabsTrigger value="definitions" disabled={screen.busy} className="gap-2">
                {t.crmCustomFields.definitionsTab}
                {screen.hasLoaded && <Badge tone="neutral">{formatNumber(screen.definitions.length, lang)}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="values" disabled={screen.busy}>{t.crmCustomFields.recordValuesTab}</TabsTrigger>
            </TabsList>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="size-3.5" aria-hidden="true" />{t.crmCustomFields.sharedAcrossBranches}
            </span>
          </div>
          <TabsContent value="definitions"><CustomFieldDefinitions screen={screen} /></TabsContent>
          <TabsContent value="values">
            {screen.isLoading && !screen.hasLoaded ? <Skeleton className="h-48 w-full" /> :
              screen.error && !screen.hasLoaded ? <ErrorState title={t.crmCustomFields.loadFailed}
                onRetry={() => void screen.reload()} retryLabel={t.common.retry} /> : <CustomFieldValuesPanel state={screen.recordValues} />}
          </TabsContent>
        </Tabs>
        <CreateCrmCustomFieldsModal key={screen.isCreateOpen ? "create-open" : "create-closed"} isOpen={screen.isCreateOpen}
          isSubmitting={screen.isCreating} error={screen.createError} keyError={screen.createKeyError}
          onClose={screen.closeCreate} onSubmit={screen.create} />
        <CustomFieldEditDrawer key={`edit-${screen.editor.selected?.id ?? "closed"}`} editor={screen.editor} />
        <CustomFieldRequirementsDrawer requirements={screen.requirements} />
        <ConfirmActionModal open={guard.isDiscardOpen} onOpenChange={(open) => { if (!open) guard.cancelDiscard(); }}
          title={t.common.discardTitle} description={t.common.discardDescription}
          confirmLabel={t.common.discardConfirm} cancelLabel={t.common.cancel} onConfirm={guard.confirmDiscard} />
      </div>
    </PermissionGate>
  );
}
