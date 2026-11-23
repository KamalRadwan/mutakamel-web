import { Component, computed, inject, input, model, output } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { TimeField } from '../../../../../shared/ui/date-time/time-field';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import {
  CALENDAR_TIME_ZONES,
  WEEKDAY_INDICES,
  isMaskDayActive,
  minutesToTime,
  timeToMinutes,
  toggleMaskDay,
} from '../calendars.model';

@Component({
  selector: 'app-week-editor',
  imports: [TranslocoPipe, Button, Checkbox, Dropdown, Field, TimeField],
  templateUrl: './week-editor.html',
})
export class WeekEditor {
  private static nextId = 0;
  protected readonly uid = `week-editor-${++WeekEditor.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly weekdayMask = model.required<number>();
  readonly startMinute = model.required<number>();
  readonly endMinute = model.required<number>();
  readonly timeZone = model.required<string>();
  readonly readOnly = input(true);
  readonly hoursError = input<string | null>(null);
  readonly zoneError = input<string | null>(null);

  readonly applyPattern = output<void>();

  protected readonly weekdays = WEEKDAY_INDICES;

  protected readonly weekdayText = computed(() => {
    this.i18n();
    return this.weekdays
      .filter((day) => isMaskDayActive(this.weekdayMask(), day))
      .map((day) => this.transloco.translate(`chart.daysShort.${day}`))
      .join(' · ');
  });

  protected readonly startTimeText = computed(() => minutesToTime(this.startMinute()));
  protected readonly endTimeText = computed(() => minutesToTime(this.endMinute()));

  protected readonly timeZoneOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const current = this.timeZone();
    const list = CALENDAR_TIME_ZONES.includes(current)
      ? CALENDAR_TIME_ZONES
      : [current, ...CALENDAR_TIME_ZONES];
    return list.filter(Boolean).map((zone) => ({ value: zone, label: zone }));
  });

  protected isDayChecked(weekday: number): boolean {
    return isMaskDayActive(this.weekdayMask(), weekday);
  }

  protected onDayToggle(weekday: number, checked: boolean): void {
    if (this.readOnly()) return;
    this.weekdayMask.set(toggleMaskDay(this.weekdayMask(), weekday, checked));
  }

  protected onStartTimeChange(next: string | null): void {
    if (this.readOnly()) return;
    const mins = timeToMinutes(next);
    if (!Number.isNaN(mins)) {
      this.startMinute.set(mins);
    }
  }

  protected onEndTimeChange(next: string | null): void {
    if (this.readOnly()) return;
    const mins = timeToMinutes(next);
    if (!Number.isNaN(mins)) {
      this.endMinute.set(mins);
    }
  }

  protected onTimeZoneChange(next: string): void {
    if (this.readOnly()) return;
    this.timeZone.set(next);
  }
}
