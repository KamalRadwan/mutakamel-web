import { Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerArrowsExchange, tablerCopy } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  DuplicateTemplateDto,
  TemplateConvertibleLayoutMode,
  TemplateDefinitionDetail,
  TemplateDefinitionScope,
  TemplateDraftDto,
  duplicateTemplate,
} from '../../templates.api';
import { TemplatePageService, errorDetailsOf } from '../template-page.service';

type DuplicateSourceKind = 'CURRENT_DRAFT' | 'VERSION';

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,99}$/;
const CONVERTIBLE_LAYOUTS: readonly TemplateConvertibleLayoutMode[] = [
  'HYBRID_DOCUMENT',
  'FLOW_DOCUMENT',
  'FIXED_CANVAS',
];

@Component({
  selector: 'app-template-duplicate-modal',
  imports: [TranslocoPipe, Button, Dropdown, Field, Modal],
  providers: [provideIcons({ tablerCopy, tablerArrowsExchange })],
  templateUrl: './duplicate-modal.html',
})
export class TemplateDuplicateModal {
  private static nextId = 0;
  protected readonly uid = `tpl-dup-modal-${++TemplateDuplicateModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  protected readonly language = inject(LanguageState).current;
  protected readonly service = inject(TemplatePageService);

  private readonly modal = viewChild.required<Modal>('modal');

  readonly created = output<string>();

  protected readonly definition = signal<TemplateDefinitionDetail | null>(null);
  protected readonly draft = signal<TemplateDraftDto | null>(null);
  protected readonly convertMode = signal(false);

  protected readonly sourceKind = signal<DuplicateSourceKind>('CURRENT_DRAFT');
  protected readonly targetLayout = signal<TemplateConvertibleLayoutMode>('HYBRID_DOCUMENT');
  protected readonly code = signal('');
  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly selectedScopeKey = signal('TENANT');

  protected readonly codeError = signal<string | null>(null);
  protected readonly nameError = signal<string | null>(null);
  protected readonly submitting = signal(false);

  protected readonly sourceOptions = computed<DropdownOption<DuplicateSourceKind>[]>(() => {
    this.language();
    const def = this.definition();
    const draft = this.draft();
    if (!def) return [];
    const options: DropdownOption<DuplicateSourceKind>[] = [];
    if (draft || def.capabilities.update.state === 'ENABLED') {
      const dirty = this.service.dirty();
      const baseLabel = this.transloco.translate('templatesPage.duplicateModal.sourceDraft', {
        revision: draft?.revision ?? def.currentDraft.revision,
      });
      options.push({
        value: 'CURRENT_DRAFT',
        label: dirty ? `${baseLabel} (${this.transloco.translate('templatesPage.header.saveFirst')})` : baseLabel,
        disabled: dirty,
      });
    }
    if (def.currentPublishedVersion) {
      options.push({
        value: 'VERSION',
        label: this.transloco.translate('templatesPage.duplicateModal.sourceVersion', {
          version: def.currentPublishedVersion.versionNumber,
        }),
      });
    }
    return options;
  });

  protected readonly layoutOptions = computed<DropdownOption<TemplateConvertibleLayoutMode>[]>(() => {
    this.language();
    const def = this.definition();
    return CONVERTIBLE_LAYOUTS.filter((mode) => mode !== def?.layoutMode).map((mode) => ({
      value: mode,
      label: this.transloco.translate(`templates.layouts.${mode}`),
    }));
  });

  protected readonly scopeOptions = computed<DropdownOption<string>[]>(() => {
    this.language();
    const scopes = this.service.creationScopes();
    if (scopes.length === 0) {
      const def = this.definition();
      if (!def) return [];
      const key = def.scope.type === 'TENANT' ? 'TENANT' : `COMPANY:${def.scope.companyId}`;
      return [{ value: key, label: this.service.scopeLabel(def.scope, this.transloco) }];
    }
    return scopes.map((scope) =>
      scope.type === 'TENANT'
        ? { value: 'TENANT', label: this.transloco.translate('templatesPage.overview.scopeTenant') }
        : {
            value: `COMPANY:${scope.companyId}`,
            label: this.service.scopeLabel({ type: 'COMPANY', companyId: scope.companyId }, this.transloco),
          },
    );
  });

  open(def: TemplateDefinitionDetail, draft: TemplateDraftDto | null, convertLayout: boolean): void {
    this.definition.set(def);
    this.draft.set(draft);
    this.convertMode.set(convertLayout);

    const hasDraftAccess = (!!draft || def.capabilities.update.state === 'ENABLED') && !this.service.dirty();
    this.sourceKind.set(hasDraftAccess || !def.currentPublishedVersion ? 'CURRENT_DRAFT' : 'VERSION');

    const availableLayouts = CONVERTIBLE_LAYOUTS.filter((mode) => mode !== def.layoutMode);
    this.targetLayout.set(availableLayouts[0] ?? 'HYBRID_DOCUMENT');

    this.code.set(`${def.code}_COPY`.slice(0, 100));
    this.name.set(`${def.name}`.slice(0, 200));
    this.description.set(def.description ?? '');
    this.selectedScopeKey.set(def.scope.type === 'TENANT' ? 'TENANT' : `COMPANY:${def.scope.companyId}`);

    this.codeError.set(null);
    this.nameError.set(null);
    this.modal().open();
  }

  protected onCodeInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.toUpperCase();
    this.code.set(raw);
    if (this.codeError()) {
      this.codeError.set(null);
    }
  }

  protected onNameInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.name.set(value);
    if (this.nameError() && value.trim().length > 0) {
      this.nameError.set(null);
    }
  }

  protected onDescriptionInput(event: Event): void {
    this.description.set((event.target as HTMLTextAreaElement).value);
  }

  protected async submit(): Promise<void> {
    const def = this.definition();
    if (!def || this.submitting()) return;
    if (this.sourceKind() === 'CURRENT_DRAFT' && this.service.dirty()) {
      this.notify.warning(this.transloco.translate('templatesPage.header.saveFirst'));
      return;
    }

    const normalizedCode = this.code().trim().toUpperCase();
    const trimmedName = this.name().trim();
    const trimmedDesc = this.description().trim();

    let invalid = false;
    if (!normalizedCode) {
      this.codeError.set(this.transloco.translate('templatesPage.duplicateModal.codeRequired'));
      invalid = true;
    } else if (!CODE_PATTERN.test(normalizedCode)) {
      this.codeError.set(this.transloco.translate('templatesPage.duplicateModal.codeInvalid'));
      invalid = true;
    }
    if (!trimmedName) {
      this.nameError.set(this.transloco.translate('templatesPage.duplicateModal.nameRequired'));
      invalid = true;
    }
    if (invalid) return;

    const draft = this.draft();
    const source: DuplicateTemplateDto['source'] =
      this.sourceKind() === 'VERSION' && def.currentPublishedVersion
        ? { kind: 'VERSION', versionId: def.currentPublishedVersion.templateVersionId }
        : { kind: 'CURRENT_DRAFT', expectedDraftRevision: draft?.revision ?? def.currentDraft.revision };

    const scopeKey = this.selectedScopeKey();
    const scope: TemplateDefinitionScope = scopeKey.startsWith('COMPANY:')
      ? { type: 'COMPANY', companyId: scopeKey.slice('COMPANY:'.length) }
      : { type: 'TENANT' };

    const body: DuplicateTemplateDto = {
      source,
      code: normalizedCode,
      name: trimmedName,
      description: trimmedDesc || null,
      scope,
      copyAssignments: false,
      ...(this.convertMode() ? { conversion: { layoutMode: this.targetLayout() } } : {}),
    };

    this.submitting.set(true);
    try {
      const created = await duplicateTemplate(def.templateId, body);
      this.modal().close();
      this.notify.success(this.transloco.translate('templatesPage.duplicateModal.createdToast'));
      this.created.emit(created.definition.templateId);
    } catch (error) {
      const { status, code } = errorDetailsOf(error);
      if (status === 409 && code === 'CORE.TEMPLATE.CODE.CONFLICT') {
        this.codeError.set(this.transloco.translate('templates.errors.CORE.TEMPLATE.CODE.CONFLICT'));
      } else {
        this.notify.error(this.service.translateError(this.transloco, error));
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
