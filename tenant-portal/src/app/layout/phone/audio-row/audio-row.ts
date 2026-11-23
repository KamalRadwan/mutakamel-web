import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerMicrophone,
  tablerMicrophoneOff,
  tablerVolume,
  tablerVolumeOff,
} from '@ng-icons/tabler-icons';
import { PhoneState } from '../../../core/phone/phone';

@Component({
  selector: 'app-audio-row',
  imports: [TranslocoPipe, NgIcon],
  providers: [
    provideIcons({
      tablerMicrophone,
      tablerMicrophoneOff,
      tablerVolume,
      tablerVolumeOff,
    }),
  ],
  templateUrl: './audio-row.html',
  styleUrl: './audio-row.css',
})
export class AudioRow {
  protected readonly phone = inject(PhoneState);

  readonly kind = input<'speaker' | 'mic'>('speaker');

  protected readonly isMuted = computed(() =>
    this.kind() === 'speaker' ? this.phone.speakerMuted() : this.phone.muted(),
  );

  protected readonly volume = computed(() =>
    this.kind() === 'speaker' ? this.phone.prefs().speakerVolume : this.phone.prefs().micVolume,
  );

  protected readonly levelPct = computed(() => {
    if (this.isMuted()) return 0;
    const raw = this.kind() === 'speaker' ? this.phone.speakerLevel() : this.phone.micLevel();
    return Math.min(100, Math.max(0, Math.round(raw)));
  });

  protected readonly iconName = computed(() => {
    if (this.kind() === 'speaker') {
      return this.isMuted() ? 'tablerVolumeOff' : 'tablerVolume';
    }
    return this.isMuted() ? 'tablerMicrophoneOff' : 'tablerMicrophone';
  });

  protected readonly toggleLabelKey = computed(() => {
    if (this.kind() === 'speaker') {
      return this.isMuted() ? 'webPhone.audio.unmuteSpeaker' : 'webPhone.audio.muteSpeaker';
    }
    return this.isMuted() ? 'webPhone.audio.unmuteMic' : 'webPhone.audio.muteMic';
  });

  protected readonly sliderLabelKey = computed(() =>
    this.kind() === 'speaker' ? 'webPhone.audio.speakerVolume' : 'webPhone.audio.micVolume',
  );

  protected readonly knobStartExpr = computed(() => `calc(${this.volume()}% - var(--switch-knob) / 2)`);

  protected toggleMute(): void {
    if (this.kind() === 'speaker') {
      this.phone.toggleSpeaker();
    } else {
      this.phone.toggleMute();
    }
  }

  protected onVolumeInput(event: Event): void {
    const parsed = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(100, Math.max(0, Math.round(parsed)));
    this.phone.setPref(this.kind() === 'speaker' ? 'speakerVolume' : 'micVolume', clamped);
  }
}
