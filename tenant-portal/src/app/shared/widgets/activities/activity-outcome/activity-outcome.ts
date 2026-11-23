import { Component, DestroyRef, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlarm,
  tablerAlertTriangle,
  tablerCheck,
  tablerCircleDot,
  tablerMail,
  tablerMap2,
  tablerPhone,
  tablerSquareCheck,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Button } from '../../../ui/button/button';
import { Field } from '../../../ui/field/field';
import { Modal } from '../../../ui/modal/modal';
import { Activity, LIMITS, TYPE_LOOK } from '../activities.model';

export type OutcomeMode = 'complete' | 'cancel';

export const COMPLETE_TEMPLATES = [
  'templateAsPlanned',
  'templateFollowUp',
  'templateSummarySent',
  'templateLeftMessage',
] as const;

export const CANCEL_TEMPLATES = [
  'templateRescheduled',
  'templateNotNeeded',
  'templateOtherChannel',
  'templateMistake',
] as const;

@Component({
  selector: 'app-activity-outcome',
  imports: [NgIcon, TranslocoPipe, Button, Field, Modal],
  viewProviders: [
    provideTranslocoScope('activities'),
  ],
  providers: [
    provideIcons({
      tablerCheck,
      tablerAlertTriangle,
      tablerSquareCheck,
      tablerPhone,
      tablerUsers,
      tablerMail,
      tablerMap2,
      tablerAlarm,
      tablerCircleDot,
    }),
  ],
  templateUrl: './activity-outcome.html',
})
export class ActivityOutcome {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);
  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea');

  readonly busy = input(false);

  protected readonly maxLength = LIMITS.outcome;
  protected readonly activity = signal<Activity | null>(null);
  protected readonly mode = signal<OutcomeMode>('complete');
  protected readonly text = signal('');

  protected readonly templates = computed<readonly string[]>(() =>
    this.mode() === 'complete' ? COMPLETE_TEMPLATES : CANCEL_TEMPLATES,
  );

  protected readonly typeLook = computed(() => {
    const current = this.activity();
    return current ? TYPE_LOOK[current.type] : TYPE_LOOK.OTHER;
  });

  protected readonly dueText = computed(() => {
    const current = this.activity();
    if (!current) return '';
    const date = new Date(current.dueAt);
    if (Number.isNaN(date.getTime())) return current.dueAt;
    const locale = `${this.language()}-u-nu-latn`;
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  });

  protected readonly fieldLabel = computed(() => {
    this.i18n();
    const labelKey = this.mode() === 'complete' ? 'activities.complete.outcome' : 'activities.cancel.reason';
    return this.transloco.translate(labelKey);
  });

  protected readonly overLimit = computed(() => this.text().length > this.maxLength);

  private submit: ((value: string | null) => Promise<boolean>) | null = null;
  protected readonly serverError = signal<string | null>(null);
  private lastKey: string | null = null;
  private resolver: ((value: string | null | undefined) => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.settle(undefined));
  }

  open(activity: Activity, mode: OutcomeMode = 'complete', submit?: (value: string | null) => Promise<boolean>): Promise<string | null | undefined> {
    this.settle(undefined);
    this.submit = submit ?? null;
    this.serverError.set(null);
    const nextKey = `${activity.id}:${mode}`;
    if (this.lastKey !== nextKey) {
      this.text.set('');
      this.lastKey = nextKey;
    }
    this.activity.set(activity);
    this.mode.set(mode);
    this.modal().open();
    this.textarea().nativeElement.focus();
    return new Promise<string | null | undefined>((resolve) => {
      this.resolver = resolve;
    });
  }

  clearNote(): void {
    this.text.set('');
    this.serverError.set(null);
  }

  setServerError(message: string): void {
    this.serverError.set(message);
  }

  close(): void {
    this.modal().close();
  }

  protected templateKey(template: string): string {
    return `activities.${this.mode()}.${template}`;
  }

  protected isChosen(template: string): boolean {
    this.i18n();
    const translated = this.transloco.translate(this.templateKey(template));
    return Boolean(translated) && this.text().trim() === translated;
  }

  protected applyTemplate(template: string): void {
    if (this.busy()) return;
    const translated = this.transloco.translate(this.templateKey(template));
    this.text.set(translated);
    this.textarea().nativeElement.focus();
  }

  protected onInput(event: Event): void {
    this.serverError.set(null);
    this.text.set((event.target as HTMLTextAreaElement).value);
  }

  protected async confirm(): Promise<void> {
    if (this.busy() || this.overLimit()) return;
    const trimmed = this.text().trim();
    const value = trimmed.length > 0 ? trimmed : null;
    if (this.submit && !(await this.submit(value))) return;
    const resolve = this.resolver;
    this.resolver = null;
    this.modal().close();
    resolve?.(value);
  }

  protected cancel(): void {
    if (this.busy()) return;
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (!this.resolver) return;
    this.lastKey = null;
    this.text.set('');
    this.settle(undefined);
  }

  private settle(value: string | null | undefined): void {
    const resolve = this.resolver;
    this.resolver = null;
    resolve?.(value);
  }
}
