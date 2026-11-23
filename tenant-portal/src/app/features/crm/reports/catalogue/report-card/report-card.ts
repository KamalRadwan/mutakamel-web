import { Component, computed, inject, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowsExchange,
  tablerChecklist,
  tablerClockCheck,
  tablerFileInvoice,
  tablerLock,
  tablerMail,
  tablerShieldCheck,
  tablerStar,
  tablerTarget,
  tablerTargetArrow,
  tablerTrendingUp,
  tablerUserPlus,
  tablerUsers,
  tablerUsersGroup,
} from '@ng-icons/tabler-icons';
import { tablerStarFill } from '@ng-icons/tabler-icons/fill';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { RouterLink } from '@angular/router';
import { Button } from '../../../../../shared/ui/button/button';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import {
  REPORT_DOMAIN_META,
  ReportCatalogueItem,
  isReportDisabled,
  readinessBadge,
  reportSummaryIn,
  reportTitleIn,
} from '../catalogue.model';

@Component({
  selector: 'app-report-card',
  imports: [NgIcon, TranslocoPipe, Badge, Button, RouterLink],
  providers: [
    provideIcons({
      tablerTrendingUp,
      tablerArrowsExchange,
      tablerUserPlus,
      tablerTarget,
      tablerClockCheck,
      tablerChecklist,
      tablerUsersGroup,
      tablerTargetArrow,
      tablerUsers,
      tablerFileInvoice,
      tablerMail,
      tablerShieldCheck,
      tablerStar,
      tablerStarFill,
      tablerLock,
    }),
  ],
  templateUrl: './report-card.html',
  host: { class: 'block h-full' },
})
export class ReportCard {
  private readonly language = inject(LanguageState).current;

  readonly report = input.required<ReportCatalogueItem>();
  readonly togglingFavourite = input(false);
  readonly readOnly = input(false);
  protected readonly canViewReadiness = computed(() => can('crm.analytics.readiness.view'));

  readonly open = output<ReportCatalogueItem>();
  readonly toggleFavourite = output<ReportCatalogueItem>();

  protected readonly disabled = computed(() => isReportDisabled(this.report().readiness));
  protected readonly domainMeta = computed(() => REPORT_DOMAIN_META[this.report().domain]);
  protected readonly badge = computed(() => readinessBadge(this.report().readiness));
  protected readonly title = computed(() => reportTitleIn(this.report(), this.language()));
  protected readonly summary = computed(() => reportSummaryIn(this.report(), this.language()));

  protected onCardClick(event: MouseEvent): void {
    if (this.disabled()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a')) return;
    this.open.emit(this.report());
  }

  protected onCardKeydown(event: KeyboardEvent): void {
    if (this.disabled() || event.target !== event.currentTarget) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.open.emit(this.report());
    }
  }

  protected onStarClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled() || this.readOnly() || this.togglingFavourite()) return;
    this.toggleFavourite.emit(this.report());
  }
}
