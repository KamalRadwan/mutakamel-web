import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

export type GovernanceBadgeModule = 'price' | 'policy' | 'profile';

const STATUS_TONE_CLASS: Readonly<Record<string, string>> = {
  PUBLISHED: 'bg-success text-on-success',
  LIVE_SCHEDULED: 'bg-success text-on-success',
  ACTIVE: 'bg-success text-on-success',
  SCHEDULED: 'bg-brand-soft text-on-brand-soft',
  AWAITING_ACTIVATION: 'bg-brand-soft text-on-brand-soft',
  APPROVAL_PENDING: 'bg-brand-soft text-on-brand-soft',
  APPROVED: 'bg-brand-soft text-on-brand-soft',
  TESTED: 'bg-neutral-soft text-on-neutral-soft',
  DRAFT: 'bg-warning text-on-warning',
  DRAFT_ONLY: 'bg-warning text-on-warning',
  REJECTED: 'bg-danger text-on-danger',
  RETIRED: 'bg-neutral-soft text-text-muted',
  SUPERSEDED: 'bg-neutral-soft text-text-muted',
  INACTIVE: 'bg-neutral-soft text-text-muted',
};

@Component({
  selector: 'app-version-status-badge',
  imports: [TranslocoPipe],
  template: `
    <span
      class="inline-flex h-badge shrink-0 items-center rounded-8 px-8 text-12 font-medium whitespace-nowrap"
      [class]="toneClass()"
    >
      {{ label() ?? (labelKey() | transloco) }}
    </span>
  `,
})
export class VersionStatusBadge {
  readonly module = input.required<GovernanceBadgeModule>();
  readonly status = input.required<string>();
  readonly liveScheduled = input(false);
  readonly awaitingActivation = input(false);
  readonly label = input<string | null>(null);

  protected readonly toneClass = computed(() => {
    if (this.liveScheduled()) {
      return STATUS_TONE_CLASS['LIVE_SCHEDULED'];
    }
    if (this.awaitingActivation()) {
      return STATUS_TONE_CLASS['AWAITING_ACTIVATION'];
    }
    return STATUS_TONE_CLASS[this.status()] ?? 'bg-neutral-soft text-text-muted';
  });

  protected readonly labelKey = computed(() => {
    const status = this.status();
    if (this.liveScheduled()) {
      return 'governance.status.price.liveScheduled';
    }
    if (this.awaitingActivation()) {
      return 'governance.status.policy.awaitingActivation';
    }
    if (status === 'DRAFT_ONLY' || status === 'INACTIVE') {
      return `governance.governanceState.${status}`;
    }
    if (status === 'ACTIVE') {
      return 'governance.common.active';
    }
    return `governance.status.${this.module()}.${status}`;
  });
}
