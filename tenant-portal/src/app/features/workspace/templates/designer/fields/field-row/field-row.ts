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
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAbc,
  tablerBox,
  tablerCalendar,
  tablerCash,
  tablerChevronRight,
  tablerHash,
  tablerList,
  tablerPercentage,
  tablerPhoto,
  tablerToggleLeft,
} from '@ng-icons/tabler-icons';
import { rectInPage, viewport } from '../../../../../../shared/ui/overlay/zoom';
import type { TemplateSchemaField } from '../../../templates.model';
import { FIELD_TYPE_VISUAL } from '../field-helpers';

@Component({
  selector: 'app-tpl-field-row',
  imports: [NgIcon],
  providers: [
    provideIcons({
      tablerAbc,
      tablerBox,
      tablerCalendar,
      tablerCash,
      tablerChevronRight,
      tablerHash,
      tablerList,
      tablerPercentage,
      tablerPhoto,
      tablerToggleLeft,
    }),
  ],
  templateUrl: './field-row.html',
  host: { class: 'block' },
})
export class FieldRow {
  private static nextTipSeq = 0;

  private readonly injector = inject(Injector);
  private readonly rowBtn = viewChild.required<ElementRef<HTMLButtonElement>>('rowBtn');
  private readonly tooltipEl = viewChild<ElementRef<HTMLElement>>('tooltipEl');

  readonly field = input.required<TemplateSchemaField>();
  readonly label = input.required<string>();
  readonly selected = input(false);
  readonly highlighted = input(false);
  readonly disabled = input(false);
  readonly disabledReason = input<string | null>(null);
  readonly typeLabel = input.required<string>();
  readonly requiredLabel = input.required<string>();
  readonly optionalLabel = input.required<string>();
  readonly isObject = input(false);

  readonly picked = output<void>();

  protected readonly tipId = `tpl-field-row-tip-${++FieldRow.nextTipSeq}`;
  protected readonly visual = computed(() => FIELD_TYPE_VISUAL[this.field().dataType]);
  protected readonly isRequired = computed(() => !this.field().nullable && !this.field().parentNullable);

  protected readonly tooltipVisible = signal(false);
  protected readonly tooltipPlaced = signal(false);
  protected readonly tooltipTop = signal(0);
  protected readonly tooltipStart = signal(0);

  private tipSeq = 0;

  constructor() {
    effect(() => {
      if (!this.disabled() || !this.disabledReason()) {
        this.hideTooltip();
      }
    });
  }

  protected showTooltip(): void {
    if (!this.disabled() || !this.disabledReason()) return;
    const seq = ++this.tipSeq;
    const btn = this.rowBtn().nativeElement;
    const rect = rectInPage(btn);
    const { width } = viewport();
    const rtl = getComputedStyle(btn).direction === 'rtl';

    this.tooltipTop.set(rect.bottom + 4);
    this.tooltipStart.set(rtl ? width - rect.right : rect.left);
    this.tooltipPlaced.set(false);
    this.tooltipVisible.set(true);

    afterNextRender(
      () => {
        if (seq !== this.tipSeq || !this.tooltipVisible()) return;
        const tip = this.tooltipEl()?.nativeElement;
        if (!tip) return;
        const r = rectInPage(btn);
        const t = rectInPage(tip);
        const vp = viewport();
        const isRtl = getComputedStyle(btn).direction === 'rtl';

        const spaceBelow = Math.max(8, vp.height - 8 - (r.bottom + 4));
        const top = t.height > spaceBelow && r.top - 4 - t.height >= 8 ? r.top - 4 - t.height : r.bottom + 4;
        const rawStart = isRtl ? vp.width - r.right : r.left;
        const start = Math.min(Math.max(8, rawStart), Math.max(8, vp.width - 8 - t.width));

        this.tooltipTop.set(top);
        this.tooltipStart.set(start);
        this.tooltipPlaced.set(true);
      },
      { injector: this.injector },
    );
  }

  protected hideTooltip(): void {
    this.tipSeq++;
    this.tooltipVisible.set(false);
    this.tooltipPlaced.set(false);
  }

  protected onActivate(): void {
    if (this.disabled()) return;
    this.picked.emit();
  }
}
