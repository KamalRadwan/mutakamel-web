import { Component, ElementRef, computed, input, model, output, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerX } from '@ng-icons/tabler-icons';
import { TranslocoPipe } from '@jsverse/transloco';
import { QueryField } from '../../../../query-builder/query.model';

const MAX_TOKENS = 20;
const DEFAULT_MAX_LENGTH = 200;

@Component({
  selector: 'ui-query-token-list',
  imports: [NgIcon, TranslocoPipe],
  providers: [provideIcons({ tablerX })],
  templateUrl: './token-list.html',
  host: { class: 'block w-full min-w-0' },
})
export class QueryTokenList {
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  readonly field = input.required<QueryField>();
  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly describedBy = input<string | null>(null);
  readonly tokens = model<string[]>([]);
  readonly commit = output<void>();

  protected readonly draft = signal('');

  protected readonly maxLength = computed(() => this.field().maxLength ?? DEFAULT_MAX_LENGTH);

  protected readonly dir = computed(() => {
    const mode = this.field().inputMode;
    return mode === 'tel' || mode === 'email' ? 'ltr' : 'auto';
  });

  protected readonly inputMode = computed(() => this.field().inputMode ?? 'text');

  protected readonly containerClasses = computed(() => {
    const base =
      'flex min-h-field w-full flex-wrap items-center gap-4 rounded-8 border px-6 py-0 text-12 transition-colors duration-fast';
    if (this.disabled()) {
      return `${base} cursor-not-allowed border-transparent bg-neutral-soft text-text-placeholder`;
    }
    if (this.invalid()) {
      return `${base} border-danger-border bg-surface-field text-text ring-2 ring-danger-halo`;
    }
    return `${base} border-border-field bg-surface-field text-text hover:border-border-field-hover focus-within:border-focus-ring focus-within:ring-3 focus-within:ring-focus-halo-strong`;
  });

  protected onInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const raw = inputEl.value;
    if (raw.includes(',') || raw.includes('،')) {
      const parts = raw.split(/[,،]/);
      const trailing = parts.pop() ?? '';
      this.addTokens(parts);
      this.draft.set(trailing);
      inputEl.value = trailing;
      return;
    }
    this.draft.set(raw);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      const pending = this.draft().trim();
      if (pending) {
        this.addTokens([pending]);
        this.clearDraft();
      } else {
        this.commit.emit();
      }
      return;
    }
    if (event.key === 'Backspace' && !this.draft() && this.tokens().length > 0) {
      this.tokens.update((list) => list.slice(0, -1));
    }
  }

  protected removeToken(token: string): void {
    if (this.disabled()) return;
    this.tokens.update((list) => list.filter((item) => item !== token));
    this.focusInput();
  }

  protected focusInput(): void {
    if (!this.disabled()) {
      this.inputRef()?.nativeElement.focus();
    }
  }

  private addTokens(candidates: string[]): void {
    const current = [...this.tokens()];
    const maxLen = this.maxLength();
    let changed = false;

    for (const candidate of candidates) {
      if (current.length >= MAX_TOKENS) break;
      const normalized = candidate.trim().slice(0, maxLen);
      if (!normalized || current.includes(normalized)) continue;
      current.push(normalized);
      changed = true;
    }

    if (changed) {
      this.tokens.set(current);
    }
  }

  private clearDraft(): void {
    this.draft.set('');
    const el = this.inputRef()?.nativeElement;
    if (el) el.value = '';
  }
}
