import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerX } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Button } from '../../../../../../shared/ui/button/button';
import { Field } from '../../../../../../shared/ui/field/field';
import type { TemplateBinding, TemplateTextTemplate } from '../../../templates.model';
import { DesignerState } from '../../designer-state';
import {
  TEXT_TEMPLATE_MAX_SEGMENTS,
  areTextTemplatesEqual,
  buildNormalizedTextTemplate,
  normalizeTextTemplate,
  splitTextTemplateToSlots,
  stripLineBreaks,
} from '../email-validation';

let nextInstanceId = 0;

@Component({
  selector: 'app-tpl-text-template-input',
  imports: [NgIcon, TranslocoPipe, Button, Field],
  providers: [provideIcons({ tablerX })],
  templateUrl: './text-template-input.html',
  host: { class: 'block min-w-0' },
})
export class TextTemplateInput {
  private readonly state = inject(DesignerState, { optional: true });
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly injector = inject(Injector);

  private readonly uid = `tpl-text-input-${++nextInstanceId}`;
  private readonly segInputs = viewChildren<ElementRef<HTMLInputElement>>('segInput');

  readonly value = input<TemplateTextTemplate | null>(null);
  readonly maxChars = input.required<number>();
  readonly singleLine = input(true);
  readonly label = input.required<string>();
  readonly hint = input.required<string>();
  readonly required = input(false);
  readonly error = input<string | null>(null);
  readonly readOnly = input(false);
  readonly inputId = input('');
  readonly pickField = input<((initial?: TemplateBinding) => Promise<TemplateBinding | null>) | null>(null);

  readonly valueChange = output<TemplateTextTemplate | null>();

  protected readonly firstInputId = computed(() => this.inputId() || `${this.uid}-slot-0`);
  protected readonly texts = signal<string[]>(['']);
  protected readonly bindings = signal<TemplateBinding[]>([]);
  private readonly caret = signal<{ slot: number; start: number; end: number }>({ slot: 0, start: 0, end: 0 });
  private readonly picking = signal(false);

  protected readonly charCount = computed(() =>
    this.texts().reduce((sum, part) => sum + part.length, 0),
  );

  protected readonly fullHint = computed(() => {
    this.language();
    const base = this.hint().trim();
    const note = this.transloco.translate('tplEmail.charsHint');
    return base ? `${base} ${note}` : note;
  });

  private readonly schemaUnavailable = computed(() => this.state?.schemaFailed() ?? false);

  protected readonly projectedSegmentsOnInsert = computed(() => {
    const currentTexts = this.texts();
    const currentBindings = this.bindings();
    const pos = this.caret();
    const slot = Math.max(0, Math.min(pos.slot, currentTexts.length - 1));
    const slotText = currentTexts[slot] ?? '';
    const start = Math.max(0, Math.min(pos.start, slotText.length));
    const end = Math.max(start, Math.min(pos.end, slotText.length));
    const before = slotText.slice(0, start);
    const after = slotText.slice(end);

    let segments = 0;
    for (let i = 0; i < currentTexts.length; i++) {
      if (i === slot) {
        if (before.length > 0) segments++;
        segments++;
        if (after.length > 0) segments++;
      } else if ((currentTexts[i] ?? '').length > 0) {
        segments++;
      }
      if (i < currentBindings.length) {
        segments++;
      }
    }
    return segments;
  });

  protected readonly canAddField = computed(
    () =>
      !this.readOnly() &&
      !this.picking() &&
      !this.schemaUnavailable() &&
      this.pickField() !== null &&
      this.projectedSegmentsOnInsert() <= TEXT_TEMPLATE_MAX_SEGMENTS,
  );

  protected readonly addFieldTitle = computed(() => {
    this.language();
    if (this.schemaUnavailable()) {
      return this.transloco.translate('tplDesigner.reason.schemaUnavailable');
    }
    if (this.projectedSegmentsOnInsert() > TEXT_TEMPLATE_MAX_SEGMENTS) {
      return this.transloco.translate('tplEmail.segmentsMax', { max: TEXT_TEMPLATE_MAX_SEGMENTS });
    }
    return null;
  });

  constructor() {
    effect(() => {
      const singleLine = this.singleLine();
      const incoming = normalizeTextTemplate(this.value(), singleLine);
      const current = untracked(() =>
        buildNormalizedTextTemplate(this.texts(), this.bindings(), singleLine),
      );

      if (areTextTemplatesEqual(incoming, current)) {
        return;
      }

      const next = splitTextTemplateToSlots(incoming, singleLine);
      this.texts.set(next.texts);
      this.bindings.set(next.bindings);
      const lastSlot = next.texts.length - 1;
      const lastLen = next.texts[lastSlot]?.length ?? 0;
      this.caret.set({ slot: lastSlot, start: lastLen, end: lastLen });
    });
  }

  protected fieldLabel(path: string): string {
    return this.state ? this.state.fieldLabel(path) : path;
  }

  protected segmentAriaLabel(index: number): string | null {
    this.language();
    if (this.texts().length <= 1) {
      return null;
    }
    return this.transloco.translate('tplEmail.segmentPart', {
      label: this.label(),
      n: index + 1,
    });
  }

  protected onBoxClick(event: MouseEvent): void {
    if (event.target !== event.currentTarget) return;
    const lastSlot = Math.max(0, this.texts().length - 1);
    const lastLen = this.texts()[lastSlot]?.length ?? 0;
    this.focusSlot(lastSlot, lastLen);
  }

  protected rememberCaret(slot: number, event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const len = inputEl.value.length;
    this.caret.set({
      slot,
      start: inputEl.selectionStart ?? len,
      end: inputEl.selectionEnd ?? len,
    });
  }

  protected onSlotInput(slot: number, event: Event): void {
    if (this.readOnly()) return;
    const inputEl = event.target as HTMLInputElement;
    const raw = inputEl.value;
    const nextValue = this.singleLine() ? stripLineBreaks(raw) : raw;
    if (nextValue !== raw) {
      const pos = inputEl.selectionStart ?? nextValue.length;
      inputEl.value = nextValue;
      const clamped = Math.min(pos, nextValue.length);
      inputEl.setSelectionRange(clamped, clamped);
    }

    this.texts.update((parts) => parts.map((p, idx) => (idx === slot ? nextValue : p)));
    this.caret.set({
      slot,
      start: inputEl.selectionStart ?? nextValue.length,
      end: inputEl.selectionEnd ?? nextValue.length,
    });
    this.emitChange();
  }

  protected onSlotKeydown(slot: number, event: KeyboardEvent): void {
    if (this.readOnly()) return;
    const inputEl = event.target as HTMLInputElement;
    const start = inputEl.selectionStart ?? 0;
    const end = inputEl.selectionEnd ?? 0;

    if (event.key === 'Backspace' && start === 0 && end === 0 && slot > 0) {
      event.preventDefault();
      this.removeBindingAt(slot - 1);
      return;
    }

    if (
      event.key === 'Delete' &&
      start === inputEl.value.length &&
      end === inputEl.value.length &&
      slot < this.bindings().length
    ) {
      event.preventDefault();
      this.removeBindingAt(slot);
    }
  }

  protected async onAddField(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const picker = this.pickField();
    if (!picker || !this.canAddField()) return;

    const currentTexts = this.texts();
    const pos = this.caret();
    const slot = Math.max(0, Math.min(pos.slot, currentTexts.length - 1));
    const slotText = currentTexts[slot] ?? '';
    const start = Math.max(0, Math.min(pos.start, slotText.length));
    const end = Math.max(start, Math.min(pos.end, slotText.length));

    this.picking.set(true);
    let picked: TemplateBinding | null = null;
    try {
      picked = await picker();
    } finally {
      this.picking.set(false);
    }

    if (!picked) {
      this.focusSlot(slot, start);
      return;
    }

    const latestTexts = this.texts();
    const latestBindings = this.bindings();
    const safeSlot = Math.max(0, Math.min(slot, latestTexts.length - 1));
    const latestSlotText = latestTexts[safeSlot] ?? '';
    const safeStart = Math.max(0, Math.min(start, latestSlotText.length));
    const safeEnd = Math.max(safeStart, Math.min(end, latestSlotText.length));

    const before = latestSlotText.slice(0, safeStart);
    const after = latestSlotText.slice(safeEnd);
    const nextTexts = [
      ...latestTexts.slice(0, safeSlot),
      before,
      after,
      ...latestTexts.slice(safeSlot + 1),
    ];
    const nextBindings = [
      ...latestBindings.slice(0, safeSlot),
      structuredClone(picked),
      ...latestBindings.slice(safeSlot),
    ];

    const normalized = buildNormalizedTextTemplate(nextTexts, nextBindings, this.singleLine());
    if (normalized && normalized.segments.length > TEXT_TEMPLATE_MAX_SEGMENTS) {
      return;
    }

    this.texts.set(nextTexts);
    this.bindings.set(nextBindings);
    this.emitChange();
    this.focusSlot(safeSlot + 1, 0);
  }

  protected async onEditChip(index: number, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (this.readOnly() || this.picking()) return;
    const picker = this.pickField();
    const existing = this.bindings()[index];
    if (!picker || !existing) return;

    this.picking.set(true);
    let picked: TemplateBinding | null = null;
    try {
      picked = await picker(structuredClone(existing));
    } finally {
      this.picking.set(false);
    }

    if (!picked) {
      this.focusSlot(index + 1, 0);
      return;
    }

    const nextBinding = structuredClone(picked);
    this.bindings.update((list) =>
      list.map((b, idx) => (idx === index ? nextBinding : b)),
    );
    this.emitChange();
    this.focusSlot(index + 1, 0);
  }

  protected onRemoveChip(index: number, event: MouseEvent): void {
    event.stopPropagation();
    if (this.readOnly()) return;
    this.removeBindingAt(index);
  }

  private removeBindingAt(index: number): void {
    const currentTexts = this.texts();
    const currentBindings = this.bindings();
    if (index < 0 || index >= currentBindings.length) return;

    const left = currentTexts[index] ?? '';
    const right = currentTexts[index + 1] ?? '';
    const merged = left + right;

    const nextTexts = [
      ...currentTexts.slice(0, index),
      merged,
      ...currentTexts.slice(index + 2),
    ];
    const nextBindings = [
      ...currentBindings.slice(0, index),
      ...currentBindings.slice(index + 1),
    ];

    this.texts.set(nextTexts);
    this.bindings.set(nextBindings);
    this.emitChange();
    this.focusSlot(index, left.length);
  }

  private emitChange(): void {
    const normalized = buildNormalizedTextTemplate(
      this.texts(),
      this.bindings(),
      this.singleLine(),
    );
    this.valueChange.emit(normalized);
  }

  private focusSlot(slot: number, offset: number): void {
    afterNextRender(
      () => {
        const inputs = this.segInputs();
        const target = inputs[slot]?.nativeElement;
        if (!target) return;
        target.focus();
        const clamped = Math.max(0, Math.min(offset, target.value.length));
        target.setSelectionRange(clamped, clamped);
        this.caret.set({ slot, start: clamped, end: clamped });
      },
      { injector: this.injector },
    );
  }
}
