import { Component, DestroyRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCheck,
  tablerChevronDown,
  tablerCircleCheck,
  tablerCircleX,
  tablerCopy,
  tablerLink,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  AuditDiffItem,
  AuditEvent,
  computeEventDiff,
  errorCodeOf,
  formatAuditDateTime,
  getAuditEvent,
  humanizeActionCode,
} from '../audit-log.api';

@Component({
  selector: 'app-audit-event-modal',
  imports: [NgIcon, TranslocoPipe, Button, Modal],
  providers: [
    provideIcons({
      tablerCircleCheck,
      tablerCircleX,
      tablerCopy,
      tablerCheck,
      tablerChevronDown,
      tablerLink,
    }),
  ],
  templateUrl: './audit-event-modal.html',
})
export class AuditEventModal {
  private static nextId = 0;
  protected readonly uid = `ws-audit-modal-${++AuditEventModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly destroyRef = inject(DestroyRef);

  private readonly modal = viewChild.required(Modal);

  readonly branchNames = input<ReadonlyMap<string, string>>(new Map());
  readonly userNames = input<ReadonlyMap<string, string>>(new Map());

  readonly showRelated = output<AuditEvent>();

  protected readonly event = signal<AuditEvent | null>(null);
  protected readonly loading = signal(false);
  protected readonly technicalOpen = signal(false);
  protected readonly copiedField = signal<'entityId' | 'correlationId' | null>(null);
  private loadSeq = 0;
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.copyTimer !== null) {
        clearTimeout(this.copyTimer);
        this.copyTimer = null;
      }
    });
  }

  protected readonly headerIcon = computed(() =>
    this.event()?.outcome === 'FAILURE' ? 'tablerCircleX' : 'tablerCircleCheck',
  );

  protected readonly headerTile = computed(() =>
    this.event()?.outcome === 'FAILURE' ? 'bg-icon-red' : 'bg-icon-green',
  );

  protected readonly headerTitle = computed(() => {
    this.i18n();
    const ev = this.event();
    if (!ev) return '';
    return this.translateAction(ev.action);
  });

  protected readonly headerSubtitle = computed(() => {
    this.i18n();
    const ev = this.event();
    if (!ev) return '';
    const actor = this.resolveActorLabel(ev);
    const when = formatAuditDateTime(ev.createdAt, this.language());
    return `${actor} · ${when}`;
  });

  protected readonly diffRows = computed<AuditDiffItem[]>(() => {
    const ev = this.event();
    if (!ev) return [];
    return computeEventDiff(ev);
  });

  open(preview: AuditEvent): void {
    const seq = ++this.loadSeq;
    this.event.set(preview);
    this.loading.set(true);
    this.technicalOpen.set(false);
    this.copiedField.set(null);
    this.modal().open();

    void this.fetchEvent(preview.id, seq);
  }

  close(): void {
    this.loadSeq++;
    this.modal().close();
  }

  protected onClosed(): void {
    this.loadSeq++;
    this.loading.set(false);
    this.technicalOpen.set(false);
    this.copiedField.set(null);
    this.event.set(null);
  }

  protected toggleTechnical(): void {
    this.technicalOpen.update((open) => !open);
  }

  protected onShowRelated(): void {
    const current = this.event();
    if (!current?.correlationId) return;
    this.close();
    this.showRelated.emit(current);
  }

  protected translateAction(code: string): string {
    const key = `wsAudit.actions.${code}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : humanizeActionCode(code);
  }

  protected translateEntityType(type: string): string {
    const key = `wsAudit.entityTypes.${type}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : type;
  }

  protected branchDisplay(branchId: string | null): string {
    if (!branchId) return '—';
    return this.branchNames().get(branchId) ?? branchId;
  }

  protected userDisplay(userId: string | null): string {
    if (!userId) return '—';
    return this.userNames().get(userId) ?? userId;
  }

  protected hasMetadata(ev: AuditEvent): boolean {
    return Boolean(ev.metadata && Object.keys(ev.metadata).length > 0);
  }

  protected isNullish(value: unknown): boolean {
    return value === null || value === undefined;
  }

  protected isObjectValue(value: unknown): boolean {
    return typeof value === 'object' && value !== null;
  }

  protected formatScalar(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') {
      return this.transloco.translate(value ? 'settings.common.yes' : 'settings.common.no');
    }
    return String(value);
  }

  protected formatJson(value: unknown): string {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  protected async copyText(field: 'entityId' | 'correlationId', text: string | null): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard?.writeText(text);
      this.copiedField.set(field);
      if (this.copyTimer !== null) {
        clearTimeout(this.copyTimer);
      }
      this.copyTimer = setTimeout(() => {
        this.copiedField.set(null);
        this.copyTimer = null;
      }, 1500);
      this.notify.success(this.transloco.translate('wsAudit.modal.copied'));
    } catch {
      this.notify.error(this.transloco.translate('wsAudit.modal.copyFailed'));
    }
  }

  private resolveActorLabel(ev: AuditEvent): string {
    if (ev.actorType !== 'USER') {
      return this.transloco.translate('wsAudit.actor.system');
    }
    if (ev.actorLabel) return ev.actorLabel;
    if (ev.actorUserId) {
      return this.userNames().get(ev.actorUserId) ?? ev.actorUserId;
    }
    return this.transloco.translate('wsAudit.actor.system');
  }

  private async fetchEvent(id: string, seq: number): Promise<void> {
    try {
      const full = await getAuditEvent(id);
      if (seq !== this.loadSeq) return;
      this.event.set(full);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      const code = errorCodeOf(error);
      const key = code ? `wsAudit.errors.${code}` : 'wsAudit.errors.generic';
      const translated = this.transloco.translate(key);
      const message =
        translated && translated !== key
          ? translated
          : this.transloco.translate('wsAudit.errors.generic');
      this.notify.error(message);
      this.close();
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
