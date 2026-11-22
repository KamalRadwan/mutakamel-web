import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertOctagon, tablerLoader2 } from '@ng-icons/tabler-icons';

export type AutomationBadgeKind =
  | 'profile'
  | 'profileVersion'
  | 'mapping'
  | 'run'
  | 'row'
  | 'subscription'
  | 'secret'
  | 'delivery'
  | 'attempt'
  | 'severity'
  | 'exception';

const TONE_BY_KIND_AND_VALUE: Readonly<Record<AutomationBadgeKind, Readonly<Record<string, string>>>> = {
  profile: {
    DRAFT: 'bg-warning text-on-warning',
    ACTIVE: 'bg-success text-on-success',
    RETIRED: 'bg-neutral-soft text-text-muted',
  },
  profileVersion: {
    DRAFT: 'bg-warning text-on-warning',
    TESTED: 'bg-brand-soft text-on-brand-soft',
    PUBLISHED: 'bg-success text-on-success',
    SUPERSEDED: 'bg-neutral-soft text-text-muted',
    RETIRED: 'bg-neutral-soft text-text-muted',
  },
  mapping: {
    DRAFT: 'bg-warning text-on-warning',
    ACTIVE: 'bg-success text-on-success',
    PUBLISHED: 'bg-success text-on-success',
  },
  run: {
    PENDING: 'bg-neutral-soft text-on-neutral-soft',
    PREVIEWING: 'bg-brand-soft text-on-brand-soft',
    PREVIEWED: 'bg-brand-soft text-on-brand-soft',
    EXECUTING: 'bg-brand-soft text-on-brand-soft',
    COMPLETED: 'bg-success text-on-success',
    COMPLETED_WITH_ERRORS: 'bg-warning text-on-warning',
    FAILED: 'bg-danger text-on-danger',
    CANCELLED: 'bg-neutral-soft text-text-muted',
  },
  row: {
    VALID: 'bg-brand-soft text-on-brand-soft',
    INVALID: 'bg-danger text-on-danger',
    SUCCEEDED: 'bg-success text-on-success',
    FAILED: 'bg-danger text-on-danger',
    SKIPPED: 'bg-neutral-soft text-on-neutral-soft',
    CANCELLED: 'bg-neutral-soft text-text-muted',
  },
  subscription: {
    DRAFT: 'bg-warning text-on-warning',
    ACTIVE: 'bg-success text-on-success',
    DISABLED: 'bg-neutral-soft text-text-muted',
  },
  secret: {
    PENDING: 'bg-brand-soft text-on-brand-soft',
    ACTIVE: 'bg-success text-on-success',
    OVERLAP: 'bg-warning text-on-warning',
    REVOKED: 'bg-neutral-soft text-text-muted',
    FAILED: 'bg-danger text-on-danger',
  },
  delivery: {
    PENDING: 'bg-neutral-soft text-on-neutral-soft',
    RETRY_PENDING: 'bg-warning text-on-warning',
    DELIVERED: 'bg-success text-on-success',
    FAILED: 'bg-danger text-on-danger',
    EXHAUSTED: 'bg-danger text-on-danger',
    DISABLED: 'bg-neutral-soft text-text-muted',
  },
  attempt: {
    DELIVERED: 'bg-success text-on-success',
    RETRYABLE_FAILURE: 'bg-warning text-on-warning',
    PERMANENT_FAILURE: 'bg-danger text-on-danger',
    IN_PROGRESS: 'bg-brand-soft text-on-brand-soft',
    RETRY_SCHEDULED: 'bg-warning text-on-warning',
    FAILED: 'bg-danger text-on-danger',
  },
  severity: {
    INFO: 'bg-neutral-soft text-on-neutral-soft',
    WARNING: 'bg-warning text-on-warning',
    HIGH: 'bg-danger text-on-danger',
    CRITICAL: 'bg-danger text-on-danger',
  },
  exception: {
    OPEN: 'bg-neutral-soft text-on-neutral-soft',
    ACKNOWLEDGED: 'bg-brand-soft text-on-brand-soft',
    ACTION_PENDING: 'bg-warning text-on-warning',
    RECONCILIATION_PENDING: 'bg-warning text-on-warning',
    RESOLVED: 'bg-success text-on-success',
    QUARANTINED: 'bg-danger text-on-danger',
  },
};

@Component({
  selector: 'app-automation-badge',
  imports: [NgIcon, TranslocoPipe],
  providers: [provideIcons({ tablerLoader2, tablerAlertOctagon })],
  template: `
    <span class="inline-flex h-badge shrink-0 items-center gap-4 rounded-8 px-8 text-12 font-medium whitespace-nowrap" [class]="toneClass()">
      @if (iconName(); as icon) {
        <ng-icon [name]="icon" size="12" [class]="spin() ? 'shrink-0 animate-spin' : 'shrink-0'" aria-hidden="true" />
      }
      <span>{{ label() ?? (labelKey() | transloco) }}</span>
    </span>
  `,
})
export class AutomationBadge {
  readonly kind = input.required<AutomationBadgeKind>();
  readonly value = input.required<string>();
  readonly label = input<string | null>(null);

  protected readonly toneClass = computed(() => {
    const byKind = TONE_BY_KIND_AND_VALUE[this.kind()];
    return byKind?.[this.value()] ?? 'bg-neutral-soft text-text-muted';
  });

  protected readonly spin = computed(() => {
    const k = this.kind();
    const v = this.value();
    return (k === 'secret' && v === 'PENDING') || (k === 'run' && (v === 'PREVIEWING' || v === 'EXECUTING'));
  });

  protected readonly iconName = computed<string | null>(() => {
    if (this.spin()) return 'tablerLoader2';
    if (this.kind() === 'severity' && this.value() === 'CRITICAL') return 'tablerAlertOctagon';
    return null;
  });

  protected readonly labelKey = computed(() => `automation.badge.${this.kind()}.${this.value()}`);
}
