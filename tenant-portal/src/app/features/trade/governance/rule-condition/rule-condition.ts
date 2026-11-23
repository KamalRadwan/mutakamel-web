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
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerChevronDown, tablerX } from '@ng-icons/tabler-icons';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../shared/ui/overlay/zoom';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { TagPicker, type TagOption } from '../../../../shared/ui/tag-picker/tag-picker';
import type { PolicyCondition } from '../policy.model';
import {
  type FactType,
  type PolicyFactDefinition,
  type PolicyOperator,
  factLabel,
  isDecimalFact,
  isMoneyFact,
  operatorsFor,
} from '../policy.registry';

interface ListPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

interface FactGroup {
  id: string;
  labelKey: string;
  subtitleKey: string | null;
  items: PolicyFactDefinition[];
}

const FACT_TYPE_ORDER: readonly FactType[] = ['decimal', 'number', 'string', 'boolean'];

@Component({
  selector: 'app-rule-condition',
  imports: [NgIcon, TranslocoPipe, Field, Dropdown, Segmented, TagPicker],
  providers: [provideIcons({ tablerCheck, tablerChevronDown, tablerX })],
  templateUrl: './rule-condition.html',
  host: {
    class: 'block min-w-0',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'closeMenu()',
  },
})
export class RuleCondition {
  private static nextId = 0;
  protected readonly uid = `pol-cond-${++RuleCondition.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly factTrigger = viewChild<ElementRef<HTMLButtonElement>>('factTrigger');
  private readonly factListRef = viewChild<ElementRef<HTMLElement>>('factList');

  readonly condition = input.required<PolicyCondition>();
  readonly index = input.required<number>();
  readonly showLabels = input(false);
  readonly canRemove = input(true);
  readonly kind = input.required<string>();
  readonly facts = input<readonly PolicyFactDefinition[]>([]);
  readonly supportedFactKeys = input<readonly string[]>([]);
  readonly factError = input<string | null>(null);
  readonly operatorError = input<string | null>(null);
  readonly valueError = input<string | null>(null);

  readonly conditionChange = output<PolicyCondition>();
  readonly remove = output<void>();

  protected readonly factOpen = signal(false);
  protected readonly factPlaced = signal(false);
  protected readonly factPlace = signal<ListPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  private factSeq = 0;

  private readonly factMap = computed(() => new Map(this.facts().map((f) => [f.key, f])));
  private readonly supportedSet = computed(() => new Set(this.supportedFactKeys()));

  protected readonly selectedFact = computed<PolicyFactDefinition | null>(
    () => this.factMap().get(this.condition().fact) ?? null,
  );

  protected readonly factType = computed<FactType>(() => this.selectedFact()?.type ?? 'string');
  protected readonly isDecimal = computed(() => {
    const sel = this.selectedFact();
    return isDecimalFact(sel) || isMoneyFact(this.condition().fact);
  });
  protected readonly isNumericOrDecimal = computed(
    () => this.factType() === 'number' || this.factType() === 'decimal',
  );

  protected factDisplay(key: string): string {
    this.i18n();
    return factLabel((k) => this.transloco.translate(k), key);
  }

  protected readonly isUnsupportedFact = computed(() => {
    const key = this.condition().fact;
    const supported = this.supportedSet();
    return Boolean(key) && supported.size > 0 && !supported.has(key);
  });

  protected readonly factGroups = computed<FactGroup[]>(() => {
    const allFacts = this.facts();
    const supported = this.supportedSet();
    const supportedFacts = supported.size > 0 ? allFacts.filter((f) => supported.has(f.key)) : allFacts;
    const otherFacts = supported.size > 0 ? allFacts.filter((f) => !supported.has(f.key)) : [];

    const groups: FactGroup[] = [];
    for (const type of FACT_TYPE_ORDER) {
      const items = supportedFacts.filter((f) => f.type === type);
      if (items.length > 0) {
        groups.push({
          id: `type-${type}`,
          labelKey: `policy.factTypes.${type}`,
          subtitleKey: null,
          items,
        });
      }
    }
    if (otherFacts.length > 0) {
      groups.push({
        id: 'other-facts',
        labelKey: 'policy.rules.otherFactsGroup',
        subtitleKey: 'policy.rules.unsupportedFactHint',
        items: otherFacts,
      });
    }
    return groups;
  });

  protected readonly operatorOptions = computed<DropdownOption<PolicyOperator>[]>(() => {
    this.i18n();
    const ops = operatorsFor(this.factType());
    return ops.map((op) => ({
      value: op,
      label: this.transloco.translate(`policy.operators.${op}`),
    }));
  });

  protected readonly booleanOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'true', label: this.transloco.translate('policy.rules.yes') },
      { value: 'false', label: this.transloco.translate('policy.rules.no') },
    ];
  });

  protected readonly boolStringValue = computed<string>(() => (this.condition().value === true ? 'true' : 'false'));

  protected readonly numberTextValue = computed<string>(() => {
    const val = this.condition().value;
    if (val === null || val === undefined || Array.isArray(val) || typeof val === 'boolean') {
      return '';
    }
    return String(val);
  });

  protected readonly stringTextValue = computed<string>(() => {
    const val = this.condition().value;
    if (val === null || val === undefined || Array.isArray(val) || typeof val === 'boolean') {
      return '';
    }
    return String(val);
  });

  protected readonly inValues = computed<string[]>(() => {
    const val = this.condition().value;
    return Array.isArray(val) ? val.map((item) => String(item)) : [];
  });

  protected readonly inTagOptions = computed<TagOption[]>(() =>
    this.inValues().map((item) => ({
      id: item,
      name: item,
      backgroundColor: null,
      textColor: null,
    })),
  );

  protected readonly createInTagFn = async (name: string): Promise<TagOption> => {
    const trimmed = name.trim();
    return { id: trimmed, name: trimmed, backgroundColor: null, textColor: null };
  };

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.factOpen()) return;
      const target = event.target;
      if (target instanceof Node && this.host.nativeElement.contains(target)) return;
      this.closeMenu();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));
  }

  protected factDescribedBy(): string | null {
    const tokens: string[] = [];
    if (this.showLabels()) {
      tokens.push(`${this.uid}-fact-hint`);
      if (this.factError()) tokens.push(`${this.uid}-fact-error`);
    } else {
      if (this.isUnsupportedFact()) tokens.push(`${this.uid}-fact-unsupported`);
      if (this.factError()) tokens.push(`${this.uid}-fact-error-inline`);
    }
    return tokens.length > 0 ? tokens.join(' ') : null;
  }

  protected operatorDescribedBy(): string | null {
    const tokens: string[] = [];
    if (this.showLabels()) {
      tokens.push(`${this.uid}-op-hint`);
      if (this.operatorError()) tokens.push(`${this.uid}-op-error`);
    } else if (this.operatorError()) {
      tokens.push(`${this.uid}-op-error-inline`);
    }
    return tokens.length > 0 ? tokens.join(' ') : null;
  }

  protected valueDescribedBy(): string | null {
    const tokens: string[] = [];
    if (this.showLabels()) {
      tokens.push(`${this.uid}-val-hint`);
      if (this.valueError()) tokens.push(`${this.uid}-val-error`);
    } else if (this.valueError()) {
      tokens.push(`${this.uid}-val-error-inline`);
    }
    return tokens.length > 0 ? tokens.join(' ') : null;
  }

  protected toggleFactMenu(): void {
    if (this.factOpen()) {
      this.closeMenu();
      return;
    }
    const seq = ++this.factSeq;
    this.factPlaced.set(false);
    this.factPlace.set(this.initialPlace());
    this.factOpen.set(true);
    queueMicrotask(() => this.placeFactList(seq));
    afterNextRender(() => this.placeFactList(seq), { injector: this.injector });
  }

  protected closeMenu(): void {
    this.factSeq += 1;
    this.factOpen.set(false);
    this.factPlaced.set(false);
  }

  protected closeIfOutside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  protected onFactKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.factOpen()) {
      event.preventDefault();
      event.stopPropagation();
      this.closeMenu();
      this.factTrigger()?.nativeElement.focus();
    }
  }

  protected chooseFact(fact: PolicyFactDefinition): void {
    const prev = this.condition();
    const prevType = this.factType();
    const allowedOps = operatorsFor(fact.type);
    const nextOp = allowedOps.includes(prev.operator) ? prev.operator : allowedOps[0];
    const decimal = isDecimalFact(fact);

    let nextValue = prev.value;
    if (nextOp === 'IN') {
      nextValue = Array.isArray(prev.value) ? prev.value : [];
    } else if (prevType !== fact.type || Array.isArray(prev.value)) {
      nextValue = fact.type === 'boolean' ? false : decimal ? '0' : fact.type === 'number' ? 0 : '';
    }

    this.closeMenu();
    this.factTrigger()?.nativeElement.focus();
    this.conditionChange.emit({
      fact: fact.key,
      operator: nextOp,
      value: nextValue,
    });
  }

  protected onOperatorChange(nextOp: PolicyOperator): void {
    const prev = this.condition();
    if (nextOp === prev.operator) return;
    const type = this.factType();
    const decimal = this.isDecimal();

    let nextValue: PolicyCondition['value'] = prev.value;
    if (nextOp === 'IN') {
      if (Array.isArray(prev.value)) {
        nextValue = prev.value;
      } else if (prev.value !== '' && prev.value !== null && prev.value !== undefined) {
        nextValue = [type === 'number' && !decimal ? Number(prev.value) : String(prev.value)];
      } else {
        nextValue = [];
      }
    } else if (prev.operator === 'IN') {
      const first = Array.isArray(prev.value) ? prev.value[0] : undefined;
      if (decimal) {
        nextValue = first !== undefined ? String(first) : '0';
      } else if (type === 'number') {
        const parsed = first !== undefined ? Number(first) : 0;
        nextValue = Number.isFinite(parsed) ? parsed : 0;
      } else if (type === 'boolean') {
        nextValue = String(first) === 'true';
      } else {
        nextValue = first !== undefined ? String(first) : '';
      }
    }

    this.conditionChange.emit({
      ...prev,
      operator: nextOp,
      value: nextValue,
    });
  }

  protected onNumberInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const trimmed = raw.trim();
    // Decimal/money thresholds stay decimal strings (never a JS number) so precision is preserved.
    const nextVal = this.isDecimal()
      ? trimmed
      : trimmed === '' ? '' : Number.isFinite(Number(trimmed)) ? Number(trimmed) : raw;
    this.conditionChange.emit({
      ...this.condition(),
      value: nextVal,
    });
  }

  protected onStringInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.conditionChange.emit({
      ...this.condition(),
      value: raw,
    });
  }

  protected onBoolChange(next: string | null): void {
    if (next !== 'true' && next !== 'false') return;
    this.conditionChange.emit({
      ...this.condition(),
      value: next === 'true',
    });
  }

  protected onInValuesChange(nextIds: string[]): void {
    const type = this.factType();
    const decimal = this.isDecimal();
    const nextValue: (string | number)[] =
      type === 'number' && !decimal
        ? nextIds.map((item) => {
            const num = Number(item);
            return Number.isFinite(num) && item.trim() !== '' ? num : item;
          })
        : [...nextIds];
    this.conditionChange.emit({
      ...this.condition(),
      value: nextValue,
    });
  }

  private initialPlace(): ListPlace {
    const triggerEl = this.factTrigger()?.nativeElement;
    if (!triggerEl) return { top: 0, start: 0, width: 240, maxHeight: null };
    const rect = rectInPage(triggerEl);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    };
  }

  private placeFactList(seq: number): void {
    if (seq !== this.factSeq || !this.factOpen() || this.factPlaced()) return;
    const triggerEl = this.factTrigger()?.nativeElement;
    const listEl = this.factListRef()?.nativeElement;
    if (!triggerEl || !listEl) return;

    const rect = rectInPage(triggerEl);
    const listRect = rectInPage(listEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = listRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = listRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? listRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + listRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - listRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - listRect.width));

    this.factPlace.set({ top, start, width: rect.width, maxHeight });
    this.factPlaced.set(true);

    listEl.style.top = `${top}px`;
    listEl.style.insetInlineStart = `${start}px`;
    listEl.style.minWidth = `${rect.width}px`;
    listEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    listEl.classList.remove('invisible');
  }
}
