import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { OrgStatus, UserStatus } from '../staff.model';

const TONE_CLASSES: Record<OrgStatus | UserStatus, string> = {
  ACTIVE: 'bg-success text-on-success',
  INACTIVE: 'bg-neutral-soft text-text-muted',
  INVITED: 'bg-brand-soft text-on-brand-soft',
  SUSPENDED: 'bg-neutral-soft text-warning-text',
  DEACTIVATED: 'bg-neutral-soft text-text-muted',
};

@Component({
  selector: 'app-staff-status-badge',
  imports: [TranslocoPipe],
  templateUrl: './status-badge.html',
})
export class StatusBadge {
  readonly status = input.required<OrgStatus | UserStatus>();

  protected readonly classes = computed(
    () =>
      `inline-flex h-badge max-w-full items-center truncate rounded-8 px-8 text-12 font-medium whitespace-nowrap ${
        TONE_CLASSES[this.status()] ?? TONE_CLASSES.INACTIVE
      }`,
  );
}
