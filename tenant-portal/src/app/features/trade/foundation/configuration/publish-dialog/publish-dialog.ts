import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerSend } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { type TradeContext, errorCodeOf, errorKey, newIdempotencyKey } from '../../../shared/trade-api';
import { formatDate } from '../../../shared/trade-format';
import { publishVersion } from '../configuration.api';
import type { ConfigDefinition, ConfigVersion, PublishedConfigVersion } from '../configuration.model';

type PublishableDefinition = Pick<ConfigDefinition, 'id' | 'key'> & {
  versions: readonly ConfigVersion[];
};

@Component({
  selector: 'app-config-publish-dialog',
  imports: [TranslocoPipe, Modal, Field, Dropdown, Button, ConfirmDialog],
  providers: [provideIcons({ tablerSend })],
  templateUrl: './publish-dialog.html',
})
export class PublishDialog {
  private static nextId = 0;
  protected readonly uid = `cfg-publish-${++PublishDialog.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly notify = inject(Notify);

  private readonly modal = viewChild.required(Modal);
  private readonly conflictDialog = viewChild.required<ConfirmDialog>('conflictDialog');

  readonly ctx = input.required<TradeContext>();
  readonly published = output<PublishedConfigVersion>();
  readonly reloadRequested = output<void>();

  protected readonly definition = signal<PublishableDefinition | null>(null);
  protected readonly targetVersion = signal<ConfigVersion | null>(null);
  protected readonly supersedesVersionId = signal<string>('');
  protected readonly publishing = signal(false);

  private allowClose = false;
  private lastFingerprint = '';
  private lastIdempotencyKey = '';

  protected readonly eligibleVersions = computed<ConfigVersion[]>(() => {
    const def = this.definition();
    const target = this.targetVersion();
    if (!def || !target) return [];
    const targetFromMs = Date.parse(target.effectiveFrom);

    return def.versions.filter((v) => {
      if (v.id === target.id) return false;
      if (v.scopeTarget !== target.scopeTarget || v.companyId !== target.companyId || v.branchId !== target.branchId) {
        return false;
      }
      if (v.effectiveState !== 'LIVE' && v.effectiveState !== 'SCHEDULED') return false;
      if (v.supersededAt !== null) return false;
      if (Date.parse(v.effectiveFrom) >= targetFromMs) return false;
      if (v.effectiveTo !== null && Date.parse(v.effectiveTo) < targetFromMs) return false;
      return true;
    });
  });

  protected readonly replacesOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const lang = this.language();
    const noneLabel = this.transloco.translate('tradeConfig.publishDialog.noneOption');
    const noEnd = this.transloco.translate('tradeConfig.definitionModal.noEnd');
    const options: DropdownOption<string>[] = [{ value: '', label: noneLabel }];

    for (const v of this.eligibleVersions()) {
      const from = formatDate(v.effectiveFrom, lang);
      const to = v.effectiveTo ? formatDate(v.effectiveTo, lang) : noEnd;
      options.push({
        value: v.id,
        label: this.transloco.translate('tradeConfig.publishDialog.versionOption', {
          n: v.versionNumber,
          from,
          to,
        }),
      });
    }
    return options;
  });

  protected readonly confirmText = computed(() => {
    this.i18n();
    const ver = this.targetVersion();
    if (!ver) return '';
    const lang = this.language();
    const date = formatDate(ver.effectiveFrom, lang);
    const isScheduled = Date.parse(ver.effectiveFrom) > Date.now();
    return this.transloco.translate(
      isScheduled ? 'tradeConfig.publishDialog.scheduledConfirm' : 'tradeConfig.publishDialog.liveConfirm',
      { n: ver.versionNumber, date },
    );
  });

  open(def: PublishableDefinition, ver: ConfigVersion): void {
    this.definition.set(def);
    this.targetVersion.set(ver);
    this.publishing.set(false);
    this.allowClose = false;
    this.lastFingerprint = '';
    this.lastIdempotencyKey = '';

    const liveOpenEnded = this.eligibleVersions().find(
      (candidate) => candidate.effectiveState === 'LIVE' && candidate.effectiveTo === null,
    );
    this.supersedesVersionId.set(liveOpenEnded?.id ?? '');
    this.modal().open();
  }

  protected close(): void {
    if (this.publishing()) return;
    this.allowClose = true;
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (this.allowClose) {
      this.allowClose = false;
    }
    this.definition.set(null);
    this.targetVersion.set(null);
    this.supersedesVersionId.set('');
    this.publishing.set(false);
  }

  protected async submit(): Promise<void> {
    const ver = this.targetVersion();
    if (!ver || this.publishing()) return;

    const supersedes = this.supersedesVersionId().trim();
    const body = supersedes ? { supersedesVersionId: supersedes } : {};
    const fingerprint = `${ver.id}:${ver.version}:${supersedes}`;
    if (fingerprint !== this.lastFingerprint || !this.lastIdempotencyKey) {
      this.lastFingerprint = fingerprint;
      this.lastIdempotencyKey = newIdempotencyKey();
    }

    this.publishing.set(true);
    try {
      const result = await publishVersion(
        this.ctx(),
        ver.id,
        ver.version,
        body,
        this.lastIdempotencyKey,
      );
      this.lastFingerprint = '';
      this.lastIdempotencyKey = '';
      const toastKey =
        result.effectiveState === 'SCHEDULED' ? 'tradeConfig.toasts.scheduled' : 'tradeConfig.toasts.published';
      this.notify.success(this.transloco.translate(toastKey, { n: result.versionNumber }));
      this.allowClose = true;
      this.modal().close();
      this.published.emit(result);
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'TRADE.APPROVAL.MAKER_CHECKER_REQUIRED') {
        this.notify.warning(this.transloco.translate('tradeConfig.toasts.makerChecker'));
        this.allowClose = true;
        this.modal().close();
      } else if (code === 'TRADE.CONFIGURATION.EFFECTIVE_OVERLAP') {
        this.notify.warning(this.transloco.translate('tradeConfig.toasts.overlap'));
        this.focusReplacesDropdown();
      } else if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        const reload = await this.conflictDialog().open();
        if (reload) {
          this.allowClose = true;
          this.modal().close();
          this.reloadRequested.emit();
        }
      } else {
        this.notify.error(this.transloco.translate(errorKey(error)));
      }
    } finally {
      this.publishing.set(false);
    }
  }

  private focusReplacesDropdown(): void {
    const trigger = this.host.nativeElement.querySelector<HTMLElement>(`#${this.uid}-replaces`);
    trigger?.focus();
  }
}
