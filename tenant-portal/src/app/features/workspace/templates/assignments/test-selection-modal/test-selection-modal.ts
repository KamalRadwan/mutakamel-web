import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBuilding,
  tablerCircleOff,
  tablerMapPin,
  tablerRoute,
  tablerWorld,
  tablerX,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { DateField } from '../../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../../shared/ui/date-time/time-field';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  ResolveTemplateAssignmentResponseDto,
  TemplateDataSourceKey,
  TemplateDefinitionDetail,
  TemplateListRow,
  TemplateLocale,
  getTemplate,
  resolveAssignment,
} from '../../templates.api';
import type { AssignmentScopeOption } from '../assignments.model';
import {
  SUPPORTED_ASSIGNMENT_SELECTORS,
  assignmentSelectorDropdownOptions,
  dateTimeToIso,
  describeAssignmentScope,
  todayDateInput,
  translateAssignmentError,
} from '../assignments.service';

@Component({
  selector: 'app-test-selection-modal',
  imports: [NgIcon, TranslocoPipe, Button, DateField, TimeField, Dropdown, Field, Modal],
  providers: [
    provideIcons({
      tablerBuilding,
      tablerCircleOff,
      tablerMapPin,
      tablerRoute,
      tablerWorld,
      tablerX,
    }),
  ],
  templateUrl: './test-selection-modal.html',
})
export class TestSelectionModal {
  private static nextId = 0;
  protected readonly uid = `test-selection-modal-${++TestSelectionModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required(Modal);

  readonly definitions = input.required<readonly TemplateListRow[]>();
  readonly scopeOptions = input.required<readonly AssignmentScopeOption[]>();

  protected readonly adapterKey = signal<TemplateDataSourceKey>('TRADE_QUOTATION_PRINT_V1');
  protected readonly locale = signal<TemplateLocale>('en-US');
  protected readonly scopeKey = signal('TENANT');
  protected readonly businessDate = signal<string | null>(null);
  protected readonly businessTime = signal<string | null>(null);
  protected readonly resolving = signal(false);
  protected readonly result = signal<ResolveTemplateAssignmentResponseDto | null>(null);
  private readonly resolvedDefinitions = signal<Record<string, TemplateDefinitionDetail>>({});

  private runSeq = 0;

  protected readonly documentOptions = computed<DropdownOption<TemplateDataSourceKey>[]>(() => {
    this.i18n();
    return assignmentSelectorDropdownOptions((key) => this.transloco.translate(key));
  });

  protected readonly languageOptions = computed<DropdownOption<TemplateLocale>[]>(() => {
    this.i18n();
    return [
      { value: 'en-US', label: this.transloco.translate('assignments.locales.en-US') },
      { value: 'ar-EG', label: this.transloco.translate('assignments.locales.ar-EG') },
    ];
  });

  protected readonly scopeDropdownOptions = computed<DropdownOption<string>[]>(() =>
    this.scopeOptions().map((opt) => ({ value: opt.key, label: opt.label })),
  );

  protected readonly chosenTemplateInfo = computed(() => {
    this.i18n();
    const chosen = this.result()?.chosen;
    if (!chosen) return null;
    const defId = chosen.version.templateDefinitionId;
    const fromList = this.definitions().find((d) => d.templateId === defId);
    const fromDetail = this.resolvedDefinitions()[defId];
    return {
      name: fromList?.name ?? fromDetail?.name ?? this.transloco.translate('assignments.table.unknownTemplate'),
      code: fromList?.code ?? fromDetail?.code ?? '',
      versionNumber: chosen.version.versionNumber,
    };
  });

  protected readonly matchedScopeDescriptor = computed(() => {
    this.i18n();
    const chosen = this.result()?.chosen;
    if (!chosen) return null;
    return describeAssignmentScope(chosen.matchedScope, this.scopeOptions(), (k) => this.transloco.translate(k));
  });

  open(defaultScopeKey: string): void {
    const resolvedScopeKey = this.scopeOptions().some((opt) => opt.key === defaultScopeKey)
      ? defaultScopeKey
      : (this.scopeOptions()[0]?.key ?? 'TENANT');

    this.adapterKey.set('TRADE_QUOTATION_PRINT_V1');
    this.locale.set('en-US');
    this.scopeKey.set(resolvedScopeKey);
    this.businessDate.set(null);
    this.businessTime.set(null);
    this.result.set(null);
    this.resolving.set(false);
    this.modal().open();
  }

  close(): void {
    if (this.resolving()) return;
    this.modal().close();
  }

  protected onBusinessDateChange(next: string | null): void {
    this.businessDate.set(next);
    if (!next) {
      this.businessTime.set(null);
    }
    this.result.set(null);
  }

  protected onBusinessTimeChange(next: string | null): void {
    this.businessTime.set(next);
    if (next && !this.businessDate()) {
      this.businessDate.set(todayDateInput());
    }
    this.result.set(null);
  }

  protected clearBusinessTime(): void {
    this.businessDate.set(null);
    this.businessTime.set(null);
    this.result.set(null);
  }

  protected onInputChange(): void {
    this.result.set(null);
  }

  protected async runTest(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.resolving()) return;

    const selector = SUPPORTED_ASSIGNMENT_SELECTORS.find((s) => s.adapterKey === this.adapterKey());
    const scopeOpt = this.scopeOptions().find((opt) => opt.key === this.scopeKey());
    if (!selector || !scopeOpt) return;

    const seq = ++this.runSeq;
    this.resolving.set(true);
    try {
      const dateVal = this.businessDate();
      const timeVal = this.businessTime();
      const businessTime = dateVal ? dateTimeToIso(dateVal, timeVal) : undefined;
      const res = await resolveAssignment({
        documentType: selector.documentType,
        outputChannel: selector.outputChannel,
        adapterKey: selector.adapterKey,
        locale: this.locale(),
        scope: scopeOpt.scope,
        businessTime,
      });
      if (seq !== this.runSeq) return;

      const defId = res.chosen?.version.templateDefinitionId;
      if (defId && !this.definitions().some((d) => d.templateId === defId) && !this.resolvedDefinitions()[defId]) {
        try {
          const detail = await getTemplate(defId);
          if (seq !== this.runSeq) return;
          this.resolvedDefinitions.update((map) => ({ ...map, [defId]: detail }));
        } catch {
          // Keep fallback label when definition detail is unavailable
        }
      }

      this.result.set(res);
    } catch (error) {
      if (seq !== this.runSeq) return;
      this.notify.error(translateAssignmentError(error, (k, p) => this.transloco.translate(k, p)));
    } finally {
      if (seq === this.runSeq) {
        this.resolving.set(false);
      }
    }
  }
}
