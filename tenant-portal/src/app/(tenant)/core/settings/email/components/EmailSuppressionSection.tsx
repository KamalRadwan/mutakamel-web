"use client";

import { Search } from "lucide-react";
import {
  Button,
  Card,
  Field,
  Input,
  PermissionGate,
  useCan,
} from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useEmailSuppression } from "../hooks/useEmailSuppression";
import { EmailSuppressionModal } from "./EmailSuppressionModal";

interface EmailSuppressionSectionProps {
  onOverlayChange?: (open: boolean) => void;
}

export function EmailSuppressionSection({ onOverlayChange }: EmailSuppressionSectionProps) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const allowed = useCan("workspace.email.manage", { tenantWide: true });
  if (!user || !allowed) return null;
  return (
    <EmailSuppressionForm
      key={realtimeAuthGeneration ?? user.id}
      onOverlayChange={onOverlayChange}
    />
  );
}

function EmailSuppressionForm({ onOverlayChange }: EmailSuppressionSectionProps) {
  const { t } = useI18n();
  const form = useEmailSuppression(onOverlayChange);
  const { copy } = form;
  const inlineError =
    !form.isLookupModalOpen && !form.confirming ? form.error : undefined;

  return (
    <PermissionGate require="workspace.email.manage" denied={form.denied}>
      <section aria-labelledby="email-suppression-title">
        <Card className="px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <h3
                  id="email-suppression-title"
                  className="text-sm font-semibold text-foreground"
                >
                  {copy.title}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">{copy.description}</p>
              <p className="text-xs text-muted-foreground">{copy.privacy}</p>
            </div>

            <form
              className="flex w-full flex-col gap-2 sm:flex-row sm:items-start lg:w-auto lg:min-w-80"
              onSubmit={(event) => {
                event.preventDefault();
                void form.lookup();
              }}
            >
              <div className="min-w-0 flex-1">
                <Field label={copy.address} showLabel={false} error={inlineError} required>
                  <Input
                    aria-label={copy.address}
                    size="sm"
                    type="email"
                    dir="ltr"
                    placeholder={copy.addressPlaceholder}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={320}
                    value={form.address}
                    onChange={(event) => form.updateAddress(event.target.value)}
                    disabled={form.pending || form.denied}
                    required
                  />
                </Field>
              </div>
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={form.pending || form.denied || !form.address.trim()}
              >
                {form.pending && !form.isLookupModalOpen && !form.confirming
                  ? copy.working
                  : copy.lookup}
              </Button>
            </form>
          </div>
        </Card>
      </section>

      <EmailSuppressionModal
        copy={copy}
        closeLabel={t.common.close}
        retryLabel={t.common.retry}
        address={form.address}
        result={form.result}
        pending={form.pending}
        confirming={form.confirming}
        isLookupModalOpen={form.isLookupModalOpen}
        error={form.error}
        notice={form.notice}
        noticeKind={form.noticeKind}
        formatDate={form.date}
        onCloseLookup={form.closeLookupModal}
        onSetConfirming={form.setConfirming}
        onRetryLookup={() => void form.lookup()}
        onConfirmLift={() => void form.lift()}
      />
    </PermissionGate>
  );
}
