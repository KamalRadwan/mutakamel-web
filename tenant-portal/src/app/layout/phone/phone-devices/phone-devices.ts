import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { translationEvents } from '../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBell, tablerMicrophone, tablerVolume } from '@ng-icons/tabler-icons';
import { PhoneState } from '../../../core/phone/phone';
import { Button } from '../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../shared/ui/field/field';
import { Segmented, SegmentedOption } from '../../../shared/ui/segmented/segmented';
import { Switch } from '../../../shared/ui/switch/switch';
import { PhonePrefs } from '../call-log-type';

let nextDevicesId = 0;

@Component({
  selector: 'app-phone-devices',
  imports: [TranslocoPipe, NgIcon, Field, Dropdown, Segmented, Switch, Button],
  providers: [
    provideTranslocoScope({ scope: 'web-phone-calls', alias: 'phoneCalls' }),
    provideIcons({ tablerBell, tablerMicrophone, tablerVolume }),
  ],
  templateUrl: './phone-devices.html',
  styleUrl: './phone-devices.css',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'flex flex-col gap-8' },
})
export class PhoneDevices {
  protected readonly phone = inject(PhoneState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  protected readonly uid = `phone-devices-${++nextDevicesId}`;

  protected readonly micPermissionBadge = computed(() => {
    switch (this.phone.micPermission()) {
      case 'granted':
        return {
          classes: 'bg-success text-on-success',
          labelKey: 'phoneCalls.settings.micPermission.allowed',
        };
      case 'simulated':
        return {
          classes: 'bg-neutral-soft text-on-neutral-soft',
          labelKey: 'phoneCalls.settings.micPermission.simulated',
        };
      case 'denied':
        return {
          classes: 'bg-danger text-on-danger',
          labelKey: 'phoneCalls.settings.micPermission.blocked',
        };
      default:
        return {
          classes: 'bg-neutral-soft text-on-neutral-soft',
          labelKey: 'phoneCalls.settings.micPermission.notAsked',
        };
    }
  });

  protected readonly micOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return this.buildDeviceOptions(this.phone.devices().inputs);
  });

  protected readonly outputOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return this.buildDeviceOptions(this.phone.devices().outputs);
  });

  protected readonly selectedMicId = computed(() => {
    const id = this.phone.prefs().micId;
    return id && this.phone.devices().inputs.some((d) => d.deviceId === id) ? id : '';
  });

  protected readonly selectedSpeakerId = computed(() => {
    const id = this.phone.prefs().speakerId;
    return id && this.phone.devices().outputs.some((d) => d.deviceId === id) ? id : '';
  });

  protected readonly selectedRingId = computed(() => {
    const id = this.phone.prefs().ringId;
    return id && this.phone.devices().outputs.some((d) => d.deviceId === id) ? id : '';
  });

  protected readonly micLevelPct = computed(() => Math.min(100, Math.max(0, Math.round(this.phone.micLevel()))));

  protected readonly ringVolumeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'off', label: this.transloco.translate('phoneCalls.settings.volumes.off') },
      { value: 'low', label: this.transloco.translate('phoneCalls.settings.volumes.low') },
      { value: 'high', label: this.transloco.translate('phoneCalls.settings.volumes.high') },
    ];
  });

  protected onMicChange(value: string): void {
    this.phone.setPref('micId', value || null);
  }

  protected onSpeakerChange(value: string): void {
    this.phone.setPref('speakerId', value || null);
  }

  protected onRingChange(value: string): void {
    this.phone.setPref('ringId', value || null);
  }

  protected onRingVolumeChange(value: string | null): void {
    if (isRingVolume(value)) {
      this.phone.setPref('ringVolume', value);
    }
  }

  protected onNotificationsChange(checked: boolean): void {
    this.phone.setPref('notifications', checked);
    if (checked && this.phone.notifyPermission() === 'default') {
      void this.phone.requestNotifyPermission();
    }
  }

  protected onAllowNotifications(): void {
    this.phone.setPref('notifications', true);
    void this.phone.requestNotifyPermission();
  }

  private buildDeviceOptions(devices: readonly MediaDeviceInfo[]): DropdownOption<string>[] {
    const options: DropdownOption<string>[] = [
      {
        value: '',
        label: this.transloco.translate('phoneCalls.settings.systemDefault'),
      },
    ];
    const seen = new Set<string>(['', 'default']);
    let fallbackIndex = 1;
    for (const device of devices) {
      if (seen.has(device.deviceId)) continue;
      seen.add(device.deviceId);
      options.push({
        value: device.deviceId,
        label:
          device.label.trim() ||
          this.transloco.translate('phoneCalls.settings.deviceFallback', { index: fallbackIndex++ }),
      });
    }
    return options;
  }
}

function isRingVolume(value: string | null): value is PhonePrefs['ringVolume'] {
  return value === 'off' || value === 'low' || value === 'high';
}
