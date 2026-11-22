import { Component, computed, inject, input, model, output } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAt,
  tablerBuilding,
  tablerDeviceMobile,
  tablerMail,
  tablerMapPin,
  tablerPhone,
  tablerUser,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { ActionItem, ActionSelection, ActionSwatch } from '../../../../shared/ui/actions-menu/actions-menu';
import { PhoneActionSource, PhoneActionSourceType, PhoneActions } from '../../../../shared/widgets/phone-actions/phone-actions';
import { RecordCard } from '../../shared/record/card/record-card';
import { RecordCardOwner } from '../../shared/record/card/record-card.model';
import { LeadLocations } from '../lead-location';
import { CARD_COLORS, CardColor, LeadRow, LeadStage, canMove, nameIn, ownerName } from '../leads.model';

export { DUE_BADGE, STARS } from '../../shared/record/card/record-card.model';

const PHONE_SOURCE_TYPE: PhoneActionSourceType = 'LEAD';

@Component({
  selector: 'app-lead-card',
  imports: [NgIcon, TranslocoPipe, PhoneActions, RecordCard],
  providers: [
    provideIcons({
      tablerAt,
      tablerBuilding,
      tablerDeviceMobile,
      tablerMail,
      tablerMapPin,
      tablerPhone,
      tablerUser,
    }),
  ],
  templateUrl: './lead-card.html',
  host: { class: 'block' },
})
export class LeadCard {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly locations = inject(LeadLocations);
  protected readonly language = inject(LanguageState).current;

  readonly lead = input.required<LeadRow>();
  readonly stages = input.required<LeadStage[]>();
  readonly detailed = input(false);
  readonly expanded = model(false);
  readonly moveTo = output<string>();
  readonly rate = output<number>();
  readonly recolor = output<CardColor | null>();
  readonly delete = output<void>();
  readonly view = output<void>();
  readonly activities = output<void>();

  protected readonly isCorporate = computed(() => this.lead().leadProfileType === 'CORPORATE');
  protected readonly cardTitle = computed(() => {
    const current = this.lead();
    return current.leadProfileType === 'CORPORATE'
      ? (current.companyName ?? current.displayName)
      : current.displayName;
  });
  protected readonly cardSubtitle = computed(() =>
    this.isCorporate() ? (this.lead().primaryContact?.displayName ?? null) : null,
  );
  protected readonly cardTypeIcon = computed(() => (this.isCorporate() ? 'tablerBuilding' : 'tablerUser'));
  protected readonly cardTypeTile = computed(() => (this.isCorporate() ? 'bg-icon-navy' : 'bg-icon-blue'));
  protected readonly cardOwner = computed<RecordCardOwner | null>(() => {
    const name = ownerName(this.lead());
    return name ? { name, avatarUrl: null } : null;
  });
  protected readonly stage = computed(() => this.stages().find((stage) => stage.id === this.lead().stageId));
  protected readonly stageName = computed(() => (this.stage() ? nameIn(this.stage()!, this.language()) : ''));
  protected readonly showDetails = computed(() => this.detailed() || this.expanded());
  protected readonly location = computed(() => this.locations.of(this.lead().address, this.language()));
  protected readonly phoneSource = computed<PhoneActionSource>(() => ({
    type: PHONE_SOURCE_TYPE,
    id: this.lead().id,
    label: this.cardTitle(),
  }));

  protected readonly actions = computed(() => {
    this.i18n();
    return leadActions(this.lead(), this.stages(), this.language(), (key, params) => this.transloco.translate(key, params));
  });

  protected act(selection: ActionSelection) {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.view.emit();
        break;
      case 'activities':
        this.activities.emit();
        break;
      case 'color':
        this.recolor.emit((selection.value as CardColor | null) ?? null);
        break;
      case 'move':
        if (selection.value) this.moveTo.emit(selection.value);
        break;
      case 'delete':
        this.delete.emit();
        break;
    }
  }
}

const COLOR_KEYS = Object.keys(CARD_COLORS) as CardColor[];

/** Build the card and table Actions menu items for a lead. */
export function leadActions(
  lead: LeadRow,
  stages: LeadStage[],
  language: string,
  translate: (key: string, params?: Record<string, string>) => string,
): ActionItem[] {
  const swatches: ActionSwatch[] = [
    ...COLOR_KEYS.map((color) => ({
      id: color,
      label: translate('leads.color.' + color),
      color: CARD_COLORS[color],
      selected: lead.cardColor === color,
    })),
    {
      id: null,
      label: translate('leads.color.none'),
      color: null,
      selected: lead.cardColor === null,
    },
  ];

  const items: ActionItem[] = [
    {
      id: 'open',
      title: translate('leads.actions.open'),
      icon: 'tablerEye',
      tile: 'bg-icon-blue',
    },
    {
      id: 'edit',
      title: translate('leads.actions.edit'),
      icon: 'tablerEdit',
      tile: 'bg-icon-orange',
    },
    {
      id: 'color',
      title: translate('leads.actions.color'),
      icon: 'tablerPalette',
      tile: 'bg-icon-violet',
      swatches,
    },
  ];

  if (canMove(lead)) {
    items.push({
      id: 'move',
      title: translate('leads.actions.move'),
      icon: 'tablerArrowsExchange',
      tile: 'bg-icon-teal',
      choices: stages
        .filter((stage) => stage.isActive)
        .map((stage) => ({
          id: stage.id,
          label: nameIn(stage, language),
          selected: stage.id === lead.stageId,
        })),
    });
  }

  items.push({
    id: 'delete',
    title: translate('leads.actions.delete'),
    icon: 'tablerTrash',
    tile: 'bg-icon-red',
    danger: true,
  });

  return items;
}
