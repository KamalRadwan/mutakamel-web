"use client";

import { useState } from "react";
import { FormInput, RefreshCw, ShieldCheck } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  FilterBar,
  PageHeader,
  PermissionGate,
  SubNav,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  NAV_SECTIONS,
  useToast,
  type ColumnDef,
} from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import { CreateCrmCustomFieldsModal } from "./components/CreateCrmCustomFieldsModal";
import { CustomFieldRequirementsDrawer } from "./components/CustomFieldRequirementsDrawer";
import { CustomFieldValuesPanel } from "./components/CustomFieldValuesPanel";
import type { CustomFieldItem } from "./custom-field-contract";
import { useCrmCustomFields } from "./hooks/useCrmCustomFields";
import { useCustomFieldRequirements } from "./hooks/useCustomFieldRequirements";

const CRM_SETUP_ITEMS = NAV_SECTIONS.find((section) => section.id === "crmSetup")?.items ?? [];

export default function CrmCustomFieldsPage() {
  const {
    t,
    items,
    searchQuery,
    setSearchQuery,
    isLoading,
    isCreating,
    error,
    createError,
    canManage,
    isCreateOpen,
    openCreate,
    closeCreate,
    handleCreate,
    reload,
  } = useCrmCustomFields();
  const toast = useToast();
  const requirements = useCustomFieldRequirements();
  const [requirementsField, setRequirementsField] =
    useState<CustomFieldItem | null>(null);
  const [requirementsError, setRequirementsError] = useState<string | null>(null);

  const canCreate = canManage && !isLoading && !error;

  const columns: ColumnDef<CustomFieldItem>[] = [
    {
      id: "name",
      header: t.crmLeadStages.arabicName,
      cell: (item) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-sm bg-muted">
            <FormInput className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          </span>
          <div>
            <p dir="rtl" className="font-medium text-foreground">
              {item.nameAr}
            </p>
            <code className="font-mono text-2xs text-muted-foreground">{item.fieldKey}</code>
          </div>
        </div>
      ),
    },
    {
      id: "nameEn",
      header: t.crmLeadStages.englishName,
      cell: (item) => <span dir="ltr">{item.nameEn}</span>,
    },
    {
      id: "owner",
      header: t.crmCustomFields.owner,
      cell: (item) => <Badge tone="neutral">{t.crmCustomFields.ownerTypes[item.ownerType] ?? item.ownerType}</Badge>,
    },
    {
      id: "fieldType",
      header: t.crmCustomFields.fieldType,
      cell: (item) => <Badge tone="neutral">{t.crmCustomFields.fieldTypes[item.type] ?? item.type}</Badge>,
    },
    {
      id: "properties",
      header: t.crmCustomFields.properties,
      cell: (item) => (
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={item.isActive ? "positive" : "neutral"}>{item.isActive ? t.common.active : t.common.inactive}</Badge>
          {item.isSearchable && <Badge tone="caution">{t.crmCustomFields.searchable}</Badge>}
          {item.optionsCount > 0 && <Badge tone="neutral">{t.crmCustomFields.optionsCount(item.optionsCount)}</Badge>}
        </div>
      ),
    },
    {
      id: "requirements",
      header: t.crmCustomFields.requirements,
      cell: (item) => {
        const required = item.requirements
          .filter((requirement) => requirement.isRequired)
          .map((requirement) => requirement.operation);
        if (required.length === 0) {
          return <span className="text-xs text-muted-foreground">{t.crmCustomFields.optional}</span>;
        }
        return (
          <div className="flex flex-wrap gap-1.5">
            {required.map((operation) => (
              <Badge key={operation} tone="caution">
                {t.crmCustomFields.requirementOperations[operation] ?? operation}
              </Badge>
            ))}
          </div>
        );
      },
    },
  ];

  if (canManage) {
    columns.push({
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (item) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`${t.crmCustomFields.requirementsTitle}: ${item.fieldKey}`}
              onClick={() => {
                setRequirementsError(null);
                setRequirementsField(item);
              }}
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t.crmCustomFields.requirementsTitle}</TooltipContent>
        </Tooltip>
      ),
    });
  }

  // A CRM route is reachable by direct URL even when the sidebar hides it, so
  // the 403 is reachable in-body and gets the mandated surface rather than a
  // load error — AGENTS.md, docs/design/states.md. Permission string and
  // scoping mirror CRM_ENTRY_ROUTES in src/lib/navigation/tenant-routes.ts.
  return (
    <PermissionGate require="crm.custom_fields.read">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.crm.cRMFormCustomFieldsCustom}
          description={t.crmCustomFields.subtitle}
          primaryAction={canCreate ? { label: t.crm.addACustomField, onClick: openCreate } : undefined}
          secondaryActions={
            <Button variant="outline" onClick={() => void reload()} disabled={isLoading}>
              <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
              {t.crmCustomFields.reload}
            </Button>
          }
        />

        <SubNav items={CRM_SETUP_ITEMS} />

        {createError && !isCreateOpen ? (
          <div role="alert" className="rounded-sm border border-caution-200 bg-caution-100 p-2.5 text-xs text-caution-800 dark:border-caution-800 dark:bg-caution-950 dark:text-caution-300">
            {createError}
          </div>
        ) : null}

        <FilterBar
          filters={[]}
          values={{}}
          onChange={() => undefined}
          onReset={() => undefined}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t.crmCustomFields.search}
        />

        {/* No pagination: this endpoint returns the whole list and declares no
            page/limit query at all (verified in its controller). The fake
            single-page object this replaced rendered working-looking controls
            over data that could never advance —
            docs/design/states.md#pagination-is-real-or-absent. */}
        <DataTable
          columns={columns}
          rows={items}
          isLoading={isLoading}
          error={error}
          onRetry={() => void reload()}
          rowKey={(item) => item.id}
          labels={{
            retry: t.common.retry,
            errorTitle: t.crmCustomFields.loadFailed,
            emptyTitle: t.crmCustomFields.empty,
            selectAll: t.common.actions,
            selectRow: t.common.actions,
            sortAscending: t.common.actions,
            sortDescending: t.common.actions,
            notSorted: t.common.actions,
            pagination: {
              previous: t.common.previousPage,
              next: t.common.nextPage,
              summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
            },
          }}
        />

        {/* Values are per record, so this panel asks for one rather than
            pretending the catalogue screen already knows which. */}
        <CustomFieldValuesPanel definitions={items} canManage={canManage} />

        <CreateCrmCustomFieldsModal
          key={isCreateOpen ? "open" : "closed"}
          isOpen={isCreateOpen}
          isSubmitting={isCreating}
          error={createError}
          onClose={closeCreate}
          onSubmit={handleCreate}
        />

        <CustomFieldRequirementsDrawer
          key={requirementsField?.id ?? "closed"}
          field={requirementsField}
          initialFlags={
            requirementsField ? requirements.readFlags(requirementsField) : null
          }
          isSubmitting={requirements.isSubmitting}
          error={requirementsError}
          onClose={() => {
            setRequirementsError(null);
            setRequirementsField(null);
          }}
          onSubmit={(flags) => {
            const target = requirementsField;
            if (!target) return;
            void requirements.save(target, flags).then((result) => {
              if (result.ok) {
                setRequirementsField(null);
                toast.success(t.crmCustomFields.requirementsSaved);
                void reload();
                return;
              }
              if (result.error) {
                if (!toast.outcomeFromApi(result.error)) {
                  setRequirementsError(t.crmCustomFields.requirementsFailed);
                }
                // A partial run leaves some operations written and some not,
                // so the list is refetched either way rather than assuming
                // the drawer's flags are what the server now holds.
                void reload();
              }
            });
          }}
        />
      </div>
    </PermissionGate>
  );
}
