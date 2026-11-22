import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerRocket } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { Checkbox } from '../../../../shared/ui/checkbox/checkbox';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { ApiError, newIdempotencyKey } from '../../shared/trade-api';
import { FAKE_ME } from '../governance-fake-actors';
import { resolvePricingError } from '../new-version-modal/new-version-modal';
import { publishVersion } from '../pricing.api';
import type { PriceVersionRow, PublishPriceVersionInput, VersionHead } from '../pricing.model';
import { formatDateOnly, formatDateTime } from '../pricing.service';

const MAX_NOTES_LENGTH = 240;

@Component({
  selector: 'app-publish-price-dialog',
  imports: [TranslocoPipe, Button, Checkbox, Dropdown, Field, Modal],
  providers: [provideIcons({ tablerRocket })],
  templateUrl: './publish-price-dialog.html',
})
export class PublishPriceDialog {
  private static nextId = 0;
  protected readonly uid = `gov-publish-price-${++PublishPriceDialog.nextId}`;
  protected readonly maxNotesLength = MAX_NOTES_LENGTH;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly lang = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly modal = viewChild.required(Modal);

  readonly versionId = input.required<string>();
  readonly versionNumber = input.required<number>();
  readonly ifMatchVersion = input.required<number>();
  readonly effectiveFrom = input.required<string>();
  readonly bookVersions = input.required<readonly VersionHead[]>();
  readonly soloOwnerGovernanceEligible = input(false);
  readonly createdByUserId = input('');

  readonly published = output<PriceVersionRow>();
  readonly staleConflict = output<void>();
  readonly closed = output<void>();

  protected readonly supersedesId = signal('');
  protected readonly approvalNotes = signal('');
  protected readonly soloOwnerAttestation = signal(false);
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);

  private lastFingerprint = '';
  private lastIdempotencyKey = '';
  private handledClose = false;

  protected readonly isSelfCreated = computed(() => this.createdByUserId() === FAKE_ME);

  protected readonly startsInFuture = computed(() => {
    const ms = Date.parse(this.effectiveFrom());
    return !Number.isNaN(ms) && ms > Date.now();
  });

  protected readonly formattedStart = computed(() => formatDateTime(this.effectiveFrom(), this.lang()));

  /**
   * publishVersion: a replacement cannot start in the past (retroactive_supersession); the replaced
   * version must be live or scheduled, not yet replaced, start earlier and still apply at the new
   * start, so an earlier end (a gap, or an already ended version) is predecessor_invalid.
   */
  protected readonly eligibleSupersedeVersions = computed<VersionHead[]>(() => {
    const currentId = this.versionId();
    const currentStartMs = Date.parse(this.effectiveFrom());
    if (Number.isNaN(currentStartMs) || currentStartMs < Date.now()) return [];
    return this.bookVersions()
      .filter((v) => {
        if (v.id === currentId) return false;
        if (v.status !== 'PUBLISHED' && v.status !== 'SCHEDULED') return false;
        if (v.supersededAt !== null) return false;
        if (v.effectiveTo !== null && Date.parse(v.effectiveTo) < currentStartMs) return false;
        return Date.parse(v.effectiveFrom) < currentStartMs;
      })
      .sort((a, b) => b.versionNumber - a.versionNumber);
  });

  protected readonly replaceOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const language = this.lang();
    const noneLabel = this.transloco.translate('pricing.publish.replacesNone');
    const options: DropdownOption<string>[] = [{ value: '', label: noneLabel }];
    for (const v of this.eligibleSupersedeVersions()) {
      const statusLabel = this.transloco.translate(`governance.status.price.${v.status}`);
      options.push({
        value: v.id,
        label: this.transloco.translate('pricing.publish.replacesOption', {
          n: v.versionNumber,
          status: statusLabel,
          from: formatDateOnly(v.effectiveFrom, language),
        }),
      });
    }
    return options;
  });

  protected readonly soloError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted() || !this.soloOwnerGovernanceEligible() || !this.isSelfCreated()) {
      return null;
    }
    return this.soloOwnerAttestation()
      ? null
      : this.transloco.translate('pricing.publish.soloOwnerRequired');
  });

  open(): void {
    this.handledClose = false;
    const defaultSupersede = this.eligibleSupersedeVersions()[0]?.id ?? '';
    this.supersedesId.set(defaultSupersede);
    this.approvalNotes.set('');
    this.soloOwnerAttestation.set(false);
    this.submitted.set(false);
    this.submitting.set(false);
    this.lastFingerprint = '';
    this.lastIdempotencyKey = '';
    this.modal().open();
  }

  close(): void {
    this.handledClose = true;
    this.modal().close();
  }

  protected onNotesInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.approvalNotes.set(value.slice(0, MAX_NOTES_LENGTH));
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    this.submitted.set(true);

    if (this.soloOwnerGovernanceEligible() && this.isSelfCreated() && !this.soloOwnerAttestation()) {
      return;
    }

    const notes = this.approvalNotes().trim();
    const payload: PublishPriceVersionInput = {
      ...(this.supersedesId() ? { supersedesVersionId: this.supersedesId() } : {}),
      ...(notes ? { approvalNotes: notes } : {}),
      // The backend reads the attestation only when the maker publishes as an eligible solo owner.
      ...(this.soloOwnerGovernanceEligible() && this.isSelfCreated()
        ? { soloOwnerAttestation: this.soloOwnerAttestation() }
        : {}),
    };

    const versionId = this.versionId();
    const ifMatch = this.ifMatchVersion();
    const fingerprint = JSON.stringify({ versionId, ifMatch, payload });
    if (fingerprint !== this.lastFingerprint || !this.lastIdempotencyKey) {
      this.lastFingerprint = fingerprint;
      this.lastIdempotencyKey = newIdempotencyKey();
    }

    this.submitting.set(true);
    try {
      const updated = await publishVersion(versionId, payload, ifMatch, this.lastIdempotencyKey);
      this.lastFingerprint = '';
      this.lastIdempotencyKey = '';
      this.notify.success(
        this.transloco.translate(
          updated.status === 'SCHEDULED'
            ? 'pricing.toasts.scheduled'
            : 'pricing.toasts.published',
        ),
      );
      this.handledClose = true;
      this.modal().close();
      this.published.emit(updated);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.handledClose = true;
        this.modal().close();
        this.staleConflict.emit();
        return;
      }
      this.notify.error(resolvePricingError(this.transloco, error));
    } finally {
      this.submitting.set(false);
    }
  }

  protected cancel(): void {
    if (this.submitting()) return;
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (this.handledClose) {
      this.handledClose = false;
      return;
    }
    this.closed.emit();
  }
}
