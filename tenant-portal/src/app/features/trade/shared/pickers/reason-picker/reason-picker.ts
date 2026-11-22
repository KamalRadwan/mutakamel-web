import { Component, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerRefresh } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { itemName, listReasons } from '../../trade-foundation.api';
import type { ReasonCode, ReasonKind } from '../../trade-foundation.model';

export interface ReasonPickerValue {
  reasonCodeId: string | null;
  note: string;
}

const MAX_NOTE_LENGTH = 500;

@Component({
  selector: 'app-trade-reason-picker',
  imports: [Field, Dropdown, Button, NgIcon, TranslocoPipe],
  providers: [
    provideTranslocoScope({ scope: 'trade-shared', alias: 'tradeShared' }),
    provideIcons({ tablerRefresh }),
  ],
  templateUrl: './reason-picker.html',
  host: { class: 'block min-w-0' },
})
export class TradeReasonPicker {
  private static nextId = 0;

  private readonly lang = inject(LanguageState);
  private readonly transloco = inject(TranslocoService);
  private readonly fallbackPrefix = `trade-reason-${++TradeReasonPicker.nextId}`;

  private loadSeq = 0;
  private prevKind: ReasonKind | null = null;

  readonly kind = input.required<ReasonKind>();
  readonly value = model<ReasonPickerValue>({ reasonCodeId: null, note: '' });
  readonly idPrefix = input('');
  readonly disabled = input(false);
  readonly showErrors = input(false);
  readonly showNote = input(true);
  /** Already-translated error from the host (for example a server-side rejection of the reason). */
  readonly error = input<string | null>(null);

  protected readonly reasons = signal<ReasonCode[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  private readonly reasonTouched = signal(false);
  private readonly noteTouched = signal(false);
  private readonly retryTick = signal(0);

  private readonly loadingText = toSignal(this.transloco.selectTranslate('tradeShared.picker.loading'), {
    initialValue: '',
  });
  private readonly noneText = toSignal(this.transloco.selectTranslate('tradeShared.reason.none'), {
    initialValue: '',
  });

  protected readonly resolvedPrefix = computed(() => this.idPrefix().trim() || this.fallbackPrefix);
  protected readonly reasonId = computed(() => `${this.resolvedPrefix()}-reason`);
  protected readonly noteId = computed(() => `${this.resolvedPrefix()}-note`);
  protected readonly maxNoteLength = MAX_NOTE_LENGTH;

  protected readonly selectedReason = computed<ReasonCode | null>(() => {
    const id = this.value().reasonCodeId;
    if (!id) return null;
    return this.reasons().find((reason) => reason.id === id) ?? null;
  });

  protected readonly noteRequired = computed(() => this.selectedReason()?.requiresNote ?? false);
  protected readonly noteLength = computed(() => this.value().note.length);

  protected readonly dropdownOptions = computed<DropdownOption<string | null>[]>(() => {
    if (this.loading()) {
      return [{ value: null, label: this.loadingText() || '…', disabled: true }];
    }
    const list = this.reasons();
    if (list.length === 0) {
      return [{ value: null, label: this.noneText() || '—', disabled: true }];
    }
    const currentLang = this.lang.current();
    return list.map((reason) => ({
      value: reason.id,
      label: itemName(reason, currentLang) || reason.code,
    }));
  });

  protected readonly reasonErrorKey = computed<string | null>(() => {
    if (!(this.showErrors() || this.reasonTouched())) return null;
    if (this.loading() || this.loadError() || this.reasons().length === 0) return null;
    return this.selectedReason() ? null : 'tradeShared.common.required';
  });

  protected readonly noteErrorKey = computed<string | null>(() => {
    if (!(this.showErrors() || this.noteTouched())) return null;
    if (this.noteRequired() && this.value().note.trim().length === 0) {
      return 'tradeShared.reason.noteRequired';
    }
    return null;
  });

  protected readonly reasonDescribedBy = computed(() => {
    const id = this.reasonId();
    return this.loadError() || this.reasonErrorKey() || this.error() ? `${id}-hint ${id}-error` : `${id}-hint`;
  });

  readonly valid = computed<boolean>(() => {
    const reason = this.selectedReason();
    if (!reason) return false;
    const note = this.value().note;
    if (!this.showNote()) return true;
    if (note.length > MAX_NOTE_LENGTH) return false;
    if (reason.requiresNote && note.trim().length === 0) return false;
    return true;
  });

  constructor() {
    effect(() => {
      const kind = this.kind();
      const _retry = this.retryTick();
      if (this.prevKind !== kind) {
        const changed = this.prevKind !== null;
        this.prevKind = kind;
        untracked(() => {
          this.reasonTouched.set(false);
          this.noteTouched.set(false);
          // A reason id belongs to one kind; drop the old kind's id from the parent model.
          if (changed && this.value().reasonCodeId !== null) {
            this.value.update((curr) => ({ ...curr, reasonCodeId: null }));
          }
        });
      }
      untracked(() => void this.loadReasonsForKind(kind));
    });
  }

  protected onReasonChange(reasonCodeId: string | null): void {
    this.reasonTouched.set(true);
    this.value.update((curr) => ({ ...curr, reasonCodeId }));
  }

  protected onNoteInput(event: Event): void {
    const note = (event.target as HTMLTextAreaElement).value;
    this.value.update((curr) => ({ ...curr, note }));
  }

  protected onNoteBlur(): void {
    this.noteTouched.set(true);
  }

  protected retry(): void {
    this.retryTick.update((n) => n + 1);
  }

  private async loadReasonsForKind(kind: ReasonKind): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const rows = await listReasons(kind);
      if (seq !== this.loadSeq) return;
      this.reasons.set(rows);
    } catch {
      if (seq !== this.loadSeq) return;
      this.reasons.set([]);
      this.loadError.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
