"use client";

import { useState } from "react";
import {
  Boxes,
  CheckCircle2,
  Clock,
  Eye,
  History,
  Lock,
  PackageCheck,
  Truck,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  cn,
  DegradedBanner,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  IdentifierText,
  PageHeader,
  PermissionGate,
  SWATCH_SURFACE_PALETTES,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { InventoryModuleSubnav } from "../components/InventoryModuleSubnav";
import { INVENTORY_RESERVE_PERMISSION } from "../inventory-contract";
import type { SessionMovementEntry } from "./movements-contract";
import { MovementPanel } from "./components/MovementPanel";
import { OpeningBalanceForm } from "./components/OpeningBalanceForm";
import { ReservationPanel } from "./components/ReservationPanel";
import { ReservationLedgerQuantities } from "./components/ReservationLedgerQuantities";
import { useInventoryMovements } from "./hooks/useInventoryMovements";

type PillarTab = "openingBalance" | "reservation" | "receipt" | "delivery";

export default function InventoryMovementsPage() {
  const {
    t,
    lang,
    isScopeResolved,
    branchIds,
    branchId,
    selectBranch,
    created,
    sessionLedger,
    knownNodes,
    pending,
    formError,
    canOpeningBalance,
    canReserve,
    canReceive,
    canDeliver,
    canAdjust,
    submitOpeningBalance,
    submitReservation,
    releaseReservation,
    submitReceipt,
    postReceipt,
    reverseReceipt,
    submitDelivery,
    postDelivery,
    reverseDelivery,
  } = useInventoryMovements();

  const isAr = lang === "ar";
  const [activeTab, setActiveTab] = useState<PillarTab>("openingBalance");
  const [selectedHandle, setSelectedEntry] = useState<SessionMovementEntry | null>(null);
  const [dossierHandle, setDossierEntry] = useState<SessionMovementEntry | null>(null);
  const selectedEntry = sessionLedger.find((entry) => entry.id === selectedHandle?.id) ?? selectedHandle;
  const dossierEntry = sessionLedger.find((entry) => entry.id === dossierHandle?.id) ?? dossierHandle;

  const canUseAny = canOpeningBalance || canReserve || canReceive || canDeliver;

  const pillars: ReadonlyArray<{
    id: PillarTab;
    label: string;
    sub: string;
    perm: boolean;
    icon: typeof Boxes;
    palette: (typeof SWATCH_SURFACE_PALETTES)[keyof typeof SWATCH_SURFACE_PALETTES];
    count: number;
  }> = [
    {
      id: "openingBalance",
      label: t.tradeInventory.openingBalanceTab,
      sub: isAr ? "رصيد افتتاحي لمرة واحدة" : "One-time initial balance",
      perm: canOpeningBalance,
      icon: Boxes,
      palette: SWATCH_SURFACE_PALETTES.green,
      count: sessionLedger.filter((e) => e.kind === "openingBalance").length,
    },
    {
      id: "reservation",
      label: t.tradeInventory.reservationTab,
      sub: isAr ? "حجز وإفراج الرصيد المتاح" : "Create & release ATP holds",
      perm: canReserve,
      icon: Lock,
      palette: SWATCH_SURFACE_PALETTES.amber,
      count: sessionLedger.filter((e) => e.kind === "reservation").length,
    },
    {
      id: "receipt",
      label: t.tradeInventory.receiptTab,
      sub: isAr ? "استلام وترحيل وعكس المشتريات" : "Create, post & reverse PO receipts",
      perm: canReceive,
      icon: PackageCheck,
      palette: SWATCH_SURFACE_PALETTES.teal,
      count: sessionLedger.filter((e) => e.kind === "receipt").length,
    },
    {
      id: "delivery",
      label: t.tradeInventory.deliveryTab,
      sub: isAr ? "تسليم وترحيل وعكس المبيعات" : "Create, post & reverse SO deliveries",
      perm: canDeliver,
      icon: Truck,
      palette: SWATCH_SURFACE_PALETTES.purple,
      count: sessionLedger.filter((e) => e.kind === "delivery").length,
    },
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <InventoryModuleSubnav active="movements" />

      <PageHeader
        className="sr-only"
        title={t.tradeInventory.movementsTitle}
        description={t.tradeInventory.movementsSubtitle}
        secondaryActions={
          <TenantBranchSelect
            branchIds={branchIds}
            branchId={branchId}
            onChange={selectBranch}
            disabled={pending !== null}
          />
        }
      />

      {/* Not a warning about this screen's health — a statement about the API:
          receipts, deliveries, reservations and opening balances expose no GET
          at all, so nothing here can be listed or reopened later (Q37). */}
      <DegradedBanner message={t.tradeInventory.movementsNoReadRoute} />

      {!isScopeResolved ? (
        <EmptyState
          icon={Truck}
          title={t.tradeInventory.selectBranchFirst}
          description={t.tradeInventory.selectBranchFirstDescription}
        />
      ) : (
        <>
          {/* 4-Pillar Interactive KPI Selector Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((pillar) => {
              const Icon = pillar.icon;
              const isSelected = activeTab === pillar.id;
              return (
                <div
                  key={pillar.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveTab(pillar.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveTab(pillar.id);
                    }
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col justify-between gap-2.5 rounded-lg border border-s-4 p-3.5 text-start transition-all",
                    pillar.palette.sectionCard,
                    pillar.palette.accentBorder,
                    isSelected
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "opacity-90 hover:opacity-100 hover:shadow-sm",
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {pillar.label}
                    </span>
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg",
                        isSelected
                          ? pillar.palette.iconBoxActive
                          : pillar.palette.iconBoxIdle,
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="flex w-full items-baseline justify-between gap-2">
                    <span className="font-mono text-xl font-semibold tabular-nums text-foreground">
                      {pillar.count} {isAr ? "عملية" : "ops"}
                    </span>
                    <Badge
                      tone={pillar.perm ? "positive" : "neutral"}
                    >
                      {pillar.perm
                        ? isAr
                          ? "مصرّح"
                          : "Permitted"
                        : isAr
                          ? "قراءة فقط"
                          : "Restricted"}
                    </Badge>
                  </div>
                  <span className="text-2xs text-muted-foreground">{pillar.sub}</span>
                </div>
              );
            })}
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as PillarTab)}
          >
            <TabsList>
              <TabsTrigger value="openingBalance">
                {t.tradeInventory.openingBalanceTab}
              </TabsTrigger>
              <TabsTrigger value="reservation">
                {t.tradeInventory.reservationTab}
              </TabsTrigger>
              <TabsTrigger value="receipt">
                {t.tradeInventory.receiptTab}
              </TabsTrigger>
              <TabsTrigger value="delivery">
                {t.tradeInventory.deliveryTab}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="openingBalance">
              <OpeningBalanceForm
                onSubmit={submitOpeningBalance}
                isPending={pending === "openingBalance"}
                disabled={!canOpeningBalance || pending !== null}
                error={formError}
                knownNodes={knownNodes}
              />
            </TabsContent>

            <TabsContent value="reservation">
              <ReservationPanel
                onCreate={submitReservation}
                onRelease={releaseReservation}
                createdId={created.reservation}
                pending={pending}
                disabled={!canReserve || pending !== null}
                error={formError}
                knownNodes={knownNodes}
                selectedTargetId={
                  selectedEntry?.kind === "reservation" ? selectedEntry.id : undefined
                }
                selectedTargetVersion={
                  selectedEntry?.kind === "reservation"
                    ? selectedEntry.version
                    : undefined
                }
              />
            </TabsContent>

            <TabsContent value="receipt">
              <MovementPanel
                sourceDocumentLabel={t.tradeInventory.purchaseOrderId}
                createLabel={t.tradeInventory.submitReceipt}
                postLabel={t.tradeInventory.postReceipt}
                reverseLabel={t.tradeInventory.reverseReceipt}
                createPendingKey="receipt"
                postPendingKey="receiptPost"
                reversePendingKey="receiptReverse"
                createdId={created.receipt}
                onCreate={submitReceipt}
                onPost={postReceipt}
                onReverse={reverseReceipt}
                sessionEntries={sessionLedger}
                pending={pending}
                disabled={!canReceive || pending !== null}
                canReverse={canAdjust && pending === null}
                error={formError}
                isDelivery={false}
                knownNodes={knownNodes}
                selectedTargetId={
                  selectedEntry?.kind === "receipt" ? selectedEntry.id : undefined
                }
                selectedTargetVersion={
                  selectedEntry?.kind === "receipt" ? selectedEntry.version : undefined
                }
              />
            </TabsContent>

            <TabsContent value="delivery">
              <MovementPanel
                sourceDocumentLabel={t.tradeInventory.salesOrderId}
                createLabel={t.tradeInventory.submitDelivery}
                postLabel={t.tradeInventory.postDelivery}
                reverseLabel={t.tradeInventory.reverseDelivery}
                createPendingKey="delivery"
                postPendingKey="deliveryPost"
                reversePendingKey="deliveryReverse"
                createdId={created.delivery}
                onCreate={submitDelivery}
                onPost={postDelivery}
                onReverse={reverseDelivery}
                sessionEntries={sessionLedger}
                pending={pending}
                disabled={!canDeliver || pending !== null}
                canReverse={canAdjust && pending === null}
                error={formError}
                isDelivery
                knownNodes={knownNodes}
                selectedTargetId={
                  selectedEntry?.kind === "delivery" ? selectedEntry.id : undefined
                }
                selectedTargetVersion={
                  selectedEntry?.kind === "delivery" ? selectedEntry.version : undefined
                }
              />
            </TabsContent>
          </Tabs>

          {/* Session Operations Activity Ledger */}
          <Card className="flex flex-col gap-3 border border-border/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <History className="size-4 text-primary" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-foreground">
                  {isAr
                    ? "سجل عمليات الجلسة الحالية (Session Movement Handles)"
                    : "Current Session Movement Handles & Activity Ledger"}
                </h3>
                <Badge tone="brand">
                  {sessionLedger.length}
                </Badge>
              </div>
              <span className="text-2xs text-muted-foreground">
                {isAr
                  ? "انقر على أي حركة لتعبئة معرّفها وإصدارها تلقائياً في نموذج الترحيل أو الإفراج أو العكس"
                  : "Click any session handle to load its ID & If-Match version into the Post / Release / Reverse form"}
              </span>
            </div>

            {sessionLedger.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/15 p-6 text-center text-xs text-muted-foreground">
                {isAr
                  ? "لم يتم تنفيذ أي حركات مخزنية في هذه الجلسة بعد. ستظهر المعرّفات المُرجعة من الخادم هنا فور إنشائها."
                  : "No inventory movements submitted in this session yet. Server-returned movement IDs will appear here for immediate follow-up actions."}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                {sessionLedger.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col justify-between gap-2.5 rounded-lg border border-border/80 bg-muted/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        tone={
                          entry.status === "POSTED" || entry.status === "ACTIVE"
                            ? "positive"
                            : entry.status === "REVERSED" || entry.status === "RELEASED"
                              ? "neutral"
                              : "caution"
                        }
                      >
                        {entry.kind.toUpperCase()} · {t.tradeStatus[entry.status]}
                      </Badge>
                      <span dir="ltr" className="font-mono text-2xs text-muted-foreground">
                        If-Match v{entry.version}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <IdentifierText className="text-xs font-semibold text-foreground">
                        {entry.id}
                      </IdentifierText>
                      <span className="text-2xs text-muted-foreground">
                        {entry.summary}
                      </span>
                    </div>

                    {entry.reservation ? <ReservationLedgerQuantities reservation={entry.reservation} /> : null}

                    <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setDossierEntry(entry)}
                      >
                        <Eye className="size-3.5" aria-hidden="true" />
                        {isAr ? "ملف 360°" : "360° Dossier"}
                      </Button>
                      {entry.kind !== "openingBalance" ? (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            setSelectedEntry(entry);
                            setActiveTab(entry.kind as PillarTab);
                          }}
                        >
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          {isAr ? "تعبئة للإجراء" : "Load for Action"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* View One: 360° Session Movement Handle Dossier Modal */}
      <Dialog
        open={dossierEntry !== null}
        onOpenChange={(open) => {
          if (!open) setDossierEntry(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogTitle>
            {dossierEntry
              ? `${t.tradeInventory.movementsTitle} — ${dossierEntry.kind.toUpperCase()}`
              : t.tradeInventory.movementsTitle}
          </DialogTitle>
          <DialogDescription>
            {isAr
              ? "ملف 360° لمعرّف الحركة المخزنية المُسجل في الجلسة الحالية"
              : "360° Session Movement Handle Dossier & Follow-up Action Launcher"}
          </DialogDescription>
          {dossierEntry ? (
            <div className="mt-3 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-2xs text-muted-foreground">
                    {t.tradeInventory.movementId}
                  </span>
                  <IdentifierText className="text-sm font-semibold text-foreground">
                    {dossierEntry.id}
                  </IdentifierText>
                </div>
                <Badge
                  tone={
                    dossierEntry.status === "POSTED" || dossierEntry.status === "ACTIVE"
                      ? "positive"
                      : dossierEntry.status === "DRAFT"
                        ? "caution"
                        : "neutral"
                  }
                >
                  {t.tradeStatus[dossierEntry.status]} (v{dossierEntry.version})
                </Badge>
              </div>

              {dossierEntry.reservation ? <ReservationLedgerQuantities reservation={dossierEntry.reservation} /> : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="text-2xs text-muted-foreground">
                    {t.tradeInventory.nodeId}
                  </span>
                  <IdentifierText className="mt-1 block text-xs font-semibold">
                    {dossierEntry.nodeId}
                  </IdentifierText>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="text-2xs text-muted-foreground">
                    {isAr ? "ملخص الحركة" : "Movement Summary"}
                  </span>
                  <span dir="ltr" className="mt-1 block font-mono text-xs font-semibold text-foreground">
                    {dossierEntry.summary}
                  </span>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="text-2xs text-muted-foreground">
                    {isAr ? "نسخة التزامن" : "If-Match Version"}
                  </span>
                  <span dir="ltr" className="mt-1 block font-mono text-xs font-semibold text-foreground">
                    v{dossierEntry.version}
                  </span>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                    <Clock className="size-3" aria-hidden="true" />
                    {isAr ? "وقت التسجيل" : "Recorded At"}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-foreground">
                    {formatDateTime(dossierEntry.recordedAt, lang)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                {dossierEntry.kind !== "openingBalance" ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      const entry = dossierEntry;
                      setDossierEntry(null);
                      setSelectedEntry(entry);
                      setActiveTab(entry.kind as PillarTab);
                    }}
                  >
                    {isAr ? "تعبئة في نموذج الترحيل / العكس" : "Load into Action Form"}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDossierEntry(null)}
                >
                  {t.common.cancel}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );

  // No `trade.inventory.movements` grant exists — these routes carry four
  // separate write permissions and no read one, so admission is "any of them".
  return canUseAny ? (
    content
  ) : (
    <PermissionGate require={INVENTORY_RESERVE_PERMISSION}>{content}</PermissionGate>
  );
}
