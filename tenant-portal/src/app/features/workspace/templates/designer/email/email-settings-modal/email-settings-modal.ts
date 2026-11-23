import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerMail } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Button } from '../../../../../../shared/ui/button/button';
import { ColorPicker } from '../../../../../../shared/ui/color-picker/color-picker';
import { designerColorSwatches } from '../../designer-color-swatches';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import type { TemplateBinding, TemplateEmailConfig, TemplateTextTemplate } from '../../../templates.model';
import { DesignerState } from '../../designer-state';
import {
  EMAIL_PREHEADER_MAX_CHARS,
  EMAIL_SUBJECT_MAX_CHARS,
  EMAIL_WIDTH_DEFAULT,
  TEXT_TEMPLATE_MAX_SEGMENTS,
  countTextTemplateChars,
  countTextTemplateSegments,
  hasNonEmptyTextTemplate,
  isValidSafeColor,
  normalizeSafeColor,
  normalizeTextTemplate,
  parseEmailWidthPx,
} from '../email-validation';
import { TextTemplateInput } from '../text-template-input/text-template-input';

let nextModalId = 0;

@Component({
  selector: 'app-tpl-email-settings-modal',
  imports: [ColorPicker, TranslocoPipe, Button, Field, Modal, TextTemplateInput],
  providers: [provideIcons({ tablerMail })],
  templateUrl: './email-settings-modal.html',
})
export class EmailSettingsModal {
  protected readonly uid = `tpl-email-settings-${++nextModalId}`;

  private readonly state = inject(DesignerState);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('modal');

  readonly pickField = input.required<(initial?: TemplateBinding) => Promise<TemplateBinding | null>>();
  readonly busy = input(false);

  protected readonly subjectMaxChars = EMAIL_SUBJECT_MAX_CHARS;
  protected readonly preheaderMaxChars = EMAIL_PREHEADER_MAX_CHARS;

  protected readonly subject = signal<TemplateTextTemplate | null>(null);
  protected readonly preheader = signal<TemplateTextTemplate | null>(null);
  protected readonly widthRaw = signal(String(EMAIL_WIDTH_DEFAULT));
  protected readonly backgroundRaw = signal('');
  private readonly attemptedSubmit = signal(false);
  private readonly widthTouched = signal(false);
  private readonly backgroundTouched = signal(false);

  protected readonly readOnly = computed(() => this.state.readOnly());

  protected readonly subjectError = computed(() => {
    this.language();
    const val = this.subject();
    if (countTextTemplateChars(val) > EMAIL_SUBJECT_MAX_CHARS) {
      return this.transloco.translate('tplEmail.charsMax', { max: EMAIL_SUBJECT_MAX_CHARS });
    }
    if (countTextTemplateSegments(val) > TEXT_TEMPLATE_MAX_SEGMENTS) {
      return this.transloco.translate('tplEmail.segmentsMax', { max: TEXT_TEMPLATE_MAX_SEGMENTS });
    }
    if (this.attemptedSubmit() && !hasNonEmptyTextTemplate(val)) {
      return this.transloco.translate('tplEmail.subject.required');
    }
    return null;
  });

  protected readonly preheaderError = computed(() => {
    this.language();
    const val = this.preheader();
    if (countTextTemplateChars(val) > EMAIL_PREHEADER_MAX_CHARS) {
      return this.transloco.translate('tplEmail.charsMax', { max: EMAIL_PREHEADER_MAX_CHARS });
    }
    if (countTextTemplateSegments(val) > TEXT_TEMPLATE_MAX_SEGMENTS) {
      return this.transloco.translate('tplEmail.segmentsMax', { max: TEXT_TEMPLATE_MAX_SEGMENTS });
    }
    return null;
  });

  protected readonly widthError = computed(() => {
    this.language();
    if (!this.attemptedSubmit() && !this.widthTouched()) return null;
    return parseEmailWidthPx(this.widthRaw()) === null
      ? this.transloco.translate('tplEmail.width.range')
      : null;
  });

  protected readonly backgroundError = computed(() => {
    this.language();
    if (!this.attemptedSubmit() && !this.backgroundTouched()) return null;
    const trimmed = this.backgroundRaw().trim();
    if (!trimmed) return null;
    return isValidSafeColor(trimmed) ? null : this.transloco.translate('tplEmail.background.invalid');
  });

  protected readonly colorSwatches = signal<readonly string[] | null>(null);

  open(): void {
    this.colorSwatches.set(designerColorSwatches(this.state.document()));
    const email = this.state.document()?.email;
    this.subject.set(email?.subject ? structuredClone(email.subject) : null);
    this.preheader.set(email?.preheader ? structuredClone(email.preheader) : null);
    this.widthRaw.set(String(email?.maxWidthPx ?? EMAIL_WIDTH_DEFAULT));
    this.backgroundRaw.set(email?.backgroundColor ?? '');
    this.attemptedSubmit.set(false);
    this.widthTouched.set(false);
    this.backgroundTouched.set(false);
    this.modal().open();
  }

  close(): void {
    this.modal().close();
  }

  protected onWidthInput(event: Event): void {
    if (this.readOnly()) return;
    this.widthRaw.set((event.target as HTMLInputElement).value);
  }

  protected onWidthBlur(): void {
    this.widthTouched.set(true);
  }

  protected onBackgroundInput(value: string | null): void {
    if (this.readOnly()) return;
    this.backgroundRaw.set(value ?? '');
  }

  protected onBackgroundBlur(): void {
    this.backgroundTouched.set(true);
    if (!this.readOnly()) {
      const raw = this.backgroundRaw();
      const norm = normalizeSafeColor(raw);
      if (norm !== undefined) {
        this.backgroundRaw.set(norm);
      } else if (!raw.trim()) {
        this.backgroundRaw.set('');
      }
    }
  }

  protected submit(event?: Event): void {
    event?.preventDefault();
    if (this.readOnly()) return;

    this.attemptedSubmit.set(true);
    const rawBg = this.backgroundRaw();
    const normBg = normalizeSafeColor(rawBg);
    if (normBg !== undefined) {
      this.backgroundRaw.set(normBg);
    } else if (!rawBg.trim()) {
      this.backgroundRaw.set('');
    }

    const parsedWidth = parseEmailWidthPx(this.widthRaw());
    if (
      this.subjectError() ||
      this.preheaderError() ||
      this.widthError() ||
      this.backgroundError() ||
      parsedWidth === null
    ) {
      return;
    }

    const normalizedSubject = normalizeTextTemplate(this.subject(), true);
    if (!normalizedSubject || !hasNonEmptyTextTemplate(normalizedSubject)) {
      return;
    }

    const normalizedPreheader = hasNonEmptyTextTemplate(this.preheader())
      ? normalizeTextTemplate(this.preheader(), true)
      : null;
    const bg = normalizeSafeColor(this.backgroundRaw());

    const nextEmail: TemplateEmailConfig = {
      maxWidthPx: parsedWidth,
      subject: normalizedSubject,
      ...(normalizedPreheader ? { preheader: normalizedPreheader } : {}),
      ...(bg ? { backgroundColor: bg } : {}),
    };

    this.state.apply('emailSettings', (doc) => {
      doc.email = nextEmail;
    });
    this.modal().close();
  }
}
