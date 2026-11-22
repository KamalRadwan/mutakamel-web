import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerCheck,
  tablerChevronDown,
  tablerCircleX,
  tablerExclamationCircle,
  tablerSearch,
  tablerX,
} from '@ng-icons/tabler-icons';
import { defaultOperator, operatorsFor, valueShape } from '../../../query-builder/query-operators';
import { Condition, Fix, Issue, Operator, OperatorLabelFn, QueryField, Value } from '../../../query-builder/query.model';
import { Dropdown, DropdownOption } from '../../dropdown/dropdown';
import { rectInPage, viewport } from '../../overlay/zoom';
import { QueryValue } from '../query-value/query-value';

export type FieldAvailabilityMap = Record<
  string,
  { enabled: boolean; reason?: 'SINGLETON' | 'EXCLUSIVE' | 'ROOT_ONLY' }
>;

interface FieldGroupBucket {
  name: string;
  fields: QueryField[];
}

interface ListPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

@Component({
  selector: 'ui-query-condition',
  imports: [NgIcon, TranslocoPipe, Dropdown, QueryValue],
  providers: [
    provideIcons({
      tablerExclamationCircle,
      tablerChevronDown,
      tablerCheck,
      tablerSearch,
      tablerX,
      tablerCircleX,
      tablerAlertTriangle,
    }),
  ],
  templateUrl: './query-condition.html',
  host: {
    class: 'block min-w-0',
    '(document:click)': 'closeFieldIfOutside($event)',
    '(window:resize)': 'closeFieldMenu()',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class QueryCondition {
  private static nextId = 0;
  private readonly uid = `ui-qb-cond-${++QueryCondition.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly fieldTriggerRef = viewChild.required<ElementRef<HTMLButtonElement>>('fieldTrigger');
  private readonly fieldMenuRef = viewChild<ElementRef<HTMLElement>>('fieldMenu');
  private readonly fieldSearchRef = viewChild<ElementRef<HTMLInputElement>>('fieldSearchInput');
  private readonly fieldOptionRefs = viewChildren<ElementRef<HTMLButtonElement>>('fieldOptionBtn');
  private readonly hintTooltipRef = viewChild<ElementRef<HTMLElement>>('hintTooltip');

  private menuSeq = 0;

  readonly condition = input.required<Condition>();
  readonly fields = input.required<QueryField[]>();
  readonly availability = input<FieldAvailabilityMap>({});
  readonly issues = input<Issue[]>([]);
  readonly touched = input(false);
  readonly timeZone = input('Africa/Cairo');
  readonly disabled = input(false);
  /** Optional host label per operator for this condition; null (or a null result) keeps the built-in label. */
  readonly operatorLabel = input<OperatorLabelFn | null>(null);

  readonly conditionChange = output<Partial<Condition>>();
  readonly remove = output<void>();
  readonly applyFix = output<Fix>();
  readonly commit = output<void>();

  protected readonly hintId = `${this.uid}-hint`;
  protected readonly issuesId = `${this.uid}-issues`;
  protected readonly fieldMenuId = `${this.uid}-field-menu`;

  protected readonly localTouched = signal(false);
  protected readonly fieldOpen = signal(false);
  protected readonly fieldPlaced = signal(false);
  protected readonly fieldSearch = signal('');
  protected readonly fieldPlace = signal<ListPlace>({ top: 0, start: 0, width: 180, maxHeight: null });
  protected readonly hintTooltipPlace = signal({ top: 0, start: 0 });
  protected readonly hintTipPlaced = signal(false);

  protected readonly isTouched = computed(() => this.touched() || this.localTouched());

  protected readonly selectedField = computed(
    () => this.fields().find((item) => item.id === this.condition().field) ?? null,
  );

  protected readonly operators = computed<Operator[]>(() => {
    const field = this.selectedField();
    return field ? operatorsFor(field) : [];
  });

  protected readonly operatorOptions = computed<DropdownOption<Operator>[]>(() => {
    this.i18n();
    const field = this.selectedField();
    const hostLabel = this.operatorLabel();
    const condition = this.condition();
    return this.operators().map((op) => ({
      value: op,
      label: hostLabel?.(condition, op, field) ?? this.builtInOperatorLabel(op, field),
    }));
  });

  protected readonly singleOperatorLabel = computed(() => {
    const opts = this.operatorOptions();
    return opts[0]?.label ?? '';
  });

  protected readonly showValue = computed(() => {
    const field = this.selectedField();
    const op = this.condition().operator;
    return Boolean(field && op && valueShape(op) !== 'none');
  });

  protected readonly rowIssues = computed(() => {
    const id = this.condition().id;
    const showErrors = this.isTouched();
    return this.issues().filter(
      (issue) => issue.nodeIds.includes(id) && (issue.severity === 'warning' || showErrors),
    );
  });

  protected readonly hasVisibleError = computed(() =>
    this.rowIssues().some((issue) => issue.severity === 'error'),
  );

  protected readonly hasWarning = computed(
    () => !this.hasVisibleError() && this.rowIssues().some((issue) => issue.severity === 'warning'),
  );

  protected readonly fieldDescribedBy = computed(() => {
    const parts: string[] = [];
    if (this.selectedField()?.hint) parts.push(this.hintId);
    if (this.rowIssues().length > 0) parts.push(this.issuesId);
    return parts.length > 0 ? parts.join(' ') : null;
  });

  protected readonly valueDescribedBy = computed(() =>
    this.rowIssues().length > 0 ? this.issuesId : null,
  );

  protected readonly groupedFields = computed<FieldGroupBucket[]>(() => {
    const term = this.fieldSearch().trim().toLowerCase();
    const filtered = term
      ? this.fields().filter(
          (field) =>
            field.label.toLowerCase().includes(term) ||
            (field.group?.toLowerCase().includes(term) ?? false),
        )
      : this.fields();

    const buckets: FieldGroupBucket[] = [];
    const byName = new Map<string, FieldGroupBucket>();
    for (const field of filtered) {
      const name = field.group ?? '';
      let bucket = byName.get(name);
      if (!bucket) {
        bucket = { name, fields: [] };
        byName.set(name, bucket);
        buckets.push(bucket);
      }
      bucket.fields.push(field);
    }
    return buckets;
  });

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.fieldOpen()) return;
      const target = event.target;
      if (target instanceof Node && this.host.nativeElement.contains(target)) return;
      this.closeFieldMenu();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));
  }

  focusField(): void {
    this.fieldTriggerRef().nativeElement.focus();
  }

  conditionId(): string {
    return this.condition().id;
  }

  fieldId(): string {
    return this.condition().field;
  }

  protected isFieldDisabled(field: QueryField): boolean {
    if (field.id === this.condition().field) return false;
    const avail = this.availability()[field.id];
    return avail ? !avail.enabled : false;
  }

  protected fieldDisabledReason(field: QueryField): string | null {
    if (field.id === this.condition().field) return null;
    const reason = this.availability()[field.id]?.reason;
    if (!reason) return null;
    this.i18n();
    return this.transloco.translate(`qb.reason.${reason}`);
  }

  protected toggleFieldMenu(): void {
    if (this.disabled()) return;
    if (this.fieldOpen()) {
      this.closeFieldMenu();
      return;
    }
    const seq = ++this.menuSeq;
    this.fieldSearch.set('');
    this.fieldPlaced.set(false);
    this.fieldPlace.set(this.initialPlace());
    this.fieldOpen.set(true);
    queueMicrotask(() => {
      this.placeFieldMenu(seq);
      this.fieldSearchRef()?.nativeElement.focus();
    });
    afterNextRender(() => this.placeFieldMenu(seq), { injector: this.injector });
  }

  protected closeFieldMenu(): void {
    this.menuSeq++;
    this.fieldOpen.set(false);
    this.fieldPlaced.set(false);
  }

  protected closeFieldIfOutside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closeFieldMenu();
    }
  }

  protected onEscape(event: Event): void {
    if (!this.fieldOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    this.closeFieldMenu();
    this.fieldTriggerRef().nativeElement.focus();
  }

  protected onFieldMenuKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = this.fieldOptionRefs()
      .map((ref) => ref.nativeElement)
      .filter((btn) => !btn.disabled);
    if (buttons.length === 0) return;

    event.preventDefault();
    const activeEl = document.activeElement as HTMLButtonElement | null;
    const index = activeEl ? buttons.indexOf(activeEl) : -1;
    if (event.key === 'ArrowDown') {
      const next = index < 0 ? 0 : (index + 1) % buttons.length;
      buttons[next]?.focus();
    } else {
      const prev = index < 0 ? buttons.length - 1 : (index - 1 + buttons.length) % buttons.length;
      buttons[prev]?.focus();
    }
  }

  protected chooseField(field: QueryField): void {
    if (this.isFieldDisabled(field)) return;
    this.localTouched.set(true);
    this.closeFieldMenu();
    this.fieldTriggerRef().nativeElement.focus();
    if (field.id === this.condition().field) return;
    this.conditionChange.emit({
      field: field.id,
      operator: defaultOperator(field),
      value: undefined,
    });
  }

  protected onOperatorChange(nextOp: Operator): void {
    this.localTouched.set(true);
    const prevOp = this.condition().operator;
    const keepValue = prevOp !== null && valueShape(prevOp) === valueShape(nextOp);
    this.conditionChange.emit({
      operator: nextOp,
      value: keepValue ? this.condition().value : undefined,
    });
  }

  protected onValueChange(nextValue: Value | undefined): void {
    this.localTouched.set(true);
    this.conditionChange.emit({ value: nextValue });
  }

  protected onCommit(): void {
    this.localTouched.set(true);
    this.commit.emit();
  }

  protected issueKey(issue: Issue): string {
    if (issue.code === 'CONTRADICTION' && issue.params['canIn']) {
      return 'qb.issue.CONTRADICTION_IN';
    }
    return `qb.issue.${issue.code}`;
  }

  protected issueParams(issue: Issue): Record<string, string | number> {
    this.i18n();
    const resolved: Record<string, string | number> = { ...issue.params };
    const fieldParam = resolved['field'];
    const matchedField =
      typeof fieldParam === 'string'
        ? this.fields().find((item) => item.id === fieldParam || item.label === fieldParam)
        : undefined;
    if (matchedField) {
      resolved['field'] = matchedField.label;
    }
    const field = matchedField ?? this.selectedField() ?? undefined;
    if (typeof resolved['opA'] === 'string') {
      resolved['a'] = this.formatIssueSide(field, resolved['opA'] as Operator, resolved['valA']);
    }
    if (typeof resolved['opB'] === 'string') {
      resolved['b'] = this.formatIssueSide(field, resolved['opB'] as Operator, resolved['valB']);
    }
    return resolved;
  }

  private formatIssueSide(
    field: QueryField | undefined,
    op: Operator,
    rawVal: string | number | undefined,
  ): string {
    if (op === 'isNull') return field?.nullLabels?.isNull ?? this.transloco.translate('qb.shortOp.isNull');
    if (op === 'isNotNull') return field?.nullLabels?.isNotNull ?? this.transloco.translate('qb.shortOp.isNotNull');
    if (rawVal === undefined || rawVal === '') return this.transloco.translate(`qb.op.${op}`);
    let valText = String(rawVal);
    if (field?.kind === 'boolean' && (valText === 'Yes' || valText === 'No' || valText === 'true' || valText === 'false')) {
      valText = this.transloco.translate(valText === 'Yes' || valText === 'true' ? 'qb.bool.true' : 'qb.bool.false');
    } else if (op === 'relative') {
      valText = this.transloco.translate(`qb.date.${valText}`);
    }
    if (op === 'eq' || op === 'is') return valText;
    if (op === 'neq' || op === 'in' || op === 'nin') {
      const shortOp = this.shortOpText(op);
      return shortOp ? `${shortOp} ${valText}` : valText;
    }
    const opLabel = this.builtInOperatorLabel(op, field ?? null);
    return `${opLabel} ${valText}`;
  }

  /** An empty translation makes Transloco return the key itself; treat that as empty. */
  private shortOpText(op: Operator): string {
    const key = `qb.shortOp.${op}`;
    const text = this.transloco.translate(key);
    return text === key ? '' : text;
  }

  protected fieldTriggerClasses(): string {
    const base =
      'inline-flex h-field w-full cursor-pointer items-center justify-between gap-6 rounded-8 border bg-surface-field px-8 text-12 text-text outline-none transition-colors duration-fast disabled:cursor-not-allowed disabled:bg-neutral-soft disabled:text-text-placeholder';
    if (this.hasVisibleError()) {
      return `${base} border-danger-border ring-2 ring-danger-halo`;
    }
    if (this.hasWarning()) {
      return `${base} border-warning focus-visible:ring-3 focus-visible:ring-focus-halo-strong`;
    }
    if (this.fieldOpen()) {
      return `${base} border-focus-ring ring-3 ring-focus-halo-strong`;
    }
    return `${base} border-border-field hover:border-border-field-hover focus-visible:border-focus-ring focus-visible:ring-3 focus-visible:ring-focus-halo-strong`;
  }

  protected placeHintTooltip(triggerEl: HTMLElement): void {
    const rect = rectInPage(triggerEl);
    const tipEl = this.hintTooltipRef()?.nativeElement;
    const tip = tipEl ? rectInPage(tipEl) : { width: 280, height: 20 };
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    let start = (rtl ? width - rect.left : rect.right) + 6;
    if (start + tip.width > width - 8) {
      const altStart = (rtl ? width - rect.right : rect.left) - 6 - tip.width;
      start = altStart >= 8 ? altStart : Math.max(8, width - 8 - tip.width);
    }

    const top = Math.max(8, rect.bottom - tip.height);
    this.hintTooltipPlace.set({ top, start });
    this.hintTipPlaced.set(true);
  }

  protected hideHintTooltip(): void {
    this.hintTipPlaced.set(false);
  }

  private builtInOperatorLabel(op: Operator, field: QueryField | null): string {
    if (op === 'isNull' && field?.nullLabels?.isNull) return field.nullLabels.isNull;
    if (op === 'isNotNull' && field?.nullLabels?.isNotNull) return field.nullLabels.isNotNull;
    return this.transloco.translate(`qb.op.${op}`);
  }

  private initialPlace(): ListPlace {
    const rect = rectInPage(this.fieldTriggerRef().nativeElement);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: Math.max(rect.width, 220),
      maxHeight: null,
    };
  }

  private placeFieldMenu(seq: number): void {
    if (seq !== this.menuSeq || !this.fieldOpen() || this.fieldPlaced()) return;
    const menuEl = this.fieldMenuRef()?.nativeElement;
    if (!menuEl) return;

    const rect = rectInPage(this.fieldTriggerRef().nativeElement);
    const menuRect = rectInPage(menuEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = menuRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = menuRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? menuRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + menuRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - menuRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - menuRect.width));

    this.fieldPlace.set({ top, start, width: Math.max(rect.width, 220), maxHeight });
    this.fieldPlaced.set(true);

    menuEl.style.top = `${top}px`;
    menuEl.style.insetInlineStart = `${start}px`;
    menuEl.style.minWidth = `${Math.max(rect.width, 220)}px`;
    menuEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    menuEl.classList.remove('invisible');
  }
}
