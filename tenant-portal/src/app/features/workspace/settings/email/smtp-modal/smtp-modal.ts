import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCircleCheck,
  tablerCircleX,
  tablerLoader2,
  tablerPlug,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { patchEmailConfig, verifySmtpConnection } from '../email.api';
import {
  EmailConflictPayload,
  EmailResult,
  PatchEmailConfigRequest,
  SMTP_ALLOWED_PORTS,
  SmtpPort,
  SmtpProtocol,
  TenantEmailConfig,
  extractApiErrorField,
  isConflictError,
  isValidSmtpHost,
  resolveEmailError,
} from '../email.model';

type SmtpField = 'smtpHost' | 'smtpPort' | 'smtpUsername' | 'smtpProtocol' | 'smtpPassword' | 'smtpSecure';
type ProbeState = 'idle' | 'checking' | 'ok' | 'error';

interface SmtpBaseline {
  smtpHost: string;
  smtpPort: SmtpPort;
  smtpUsername: string;
  smtpProtocol: SmtpProtocol;
  smtpSecure: boolean;
}

@Component({
  selector: 'app-smtp-modal',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, Modal, SettingsNotice, Switch],
  providers: [provideIcons({ tablerPlug, tablerLoader2, tablerCircleCheck, tablerCircleX })],
  templateUrl: './smtp-modal.html',
})
export class SmtpModal {
  private static nextId = 0;
  protected readonly uid = `ws-email-smtp-modal-${++SmtpModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required<Modal>('modal');

  readonly config = input<TenantEmailConfig | null>(null);
  readonly revision = input<number | null>(null);
  readonly canManage = input(true);

  readonly saved = output<EmailResult>();
  readonly conflict = output<EmailConflictPayload>();

  protected readonly switching = signal(false);
  private readonly baseline = signal<SmtpBaseline>({
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpProtocol: 'smtp',
    smtpSecure: true,
  });

  protected readonly hostDraft = signal('');
  protected readonly portDraft = signal<SmtpPort>(587);
  protected readonly usernameDraft = signal('');
  protected readonly protocolDraft = signal<SmtpProtocol>('smtp');
  protected readonly passwordDraft = signal('');
  protected readonly secureDraft = signal(true);

  protected readonly saving = signal(false);
  protected readonly probing = signal(false);
  protected readonly probeState = signal<ProbeState>('idle');
  protected readonly probeError = signal<string | null>(null);
  protected readonly submitted = signal(false);
  protected readonly touched = signal<Partial<Record<SmtpField, boolean>>>({});
  protected readonly serverFieldErrors = signal<Partial<Record<SmtpField, string>>>({});
  protected readonly topError = signal<string | null>(null);

  private allowClose = false;
  private saveOp: { fingerprint: string; key: string } | null = null;

  protected readonly isReadonly = computed(() => !this.canManage());
  protected readonly busy = computed(() => this.saving() || this.probing());

  protected readonly portOptions: DropdownOption<SmtpPort>[] = SMTP_ALLOWED_PORTS.map((port) => ({
    value: port,
    label: String(port),
  }));

  protected readonly protocolOptions: DropdownOption<SmtpProtocol>[] = [
    { value: 'smtp', label: 'SMTP' },
    { value: 'smtps', label: 'SMTPS' },
  ];

  protected readonly hasSavedPassword = computed(
    () => !this.switching() && Boolean(this.config()?.smtpPasswordConfigured),
  );

  protected readonly dirty = computed(() => {
    if (this.isReadonly()) return false;
    const base = this.baseline();
    return (
      this.hostDraft().trim().toLowerCase() !== base.smtpHost ||
      this.portDraft() !== base.smtpPort ||
      this.usernameDraft().trim() !== base.smtpUsername ||
      this.protocolDraft() !== base.smtpProtocol ||
      this.secureDraft() !== base.smtpSecure ||
      this.passwordDraft().length > 0
    );
  });

  protected readonly showResetNotice = computed(() =>
    Boolean(this.switching() && this.config()?.dkimVerified && !this.isReadonly()),
  );

  protected readonly canTest = computed(
    () =>
      !this.isReadonly() &&
      !this.busy() &&
      !this.switching() &&
      !this.dirty() &&
      Boolean(this.config()?.smtpPasswordConfigured),
  );

  protected readonly testButtonTitle = computed(() => {
    this.i18n();
    if (this.dirty()) return this.transloco.translate('wsEmail.smtp.testNeedsSave');
    return null;
  });

  private readonly rawHostError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors().smtpHost;
    if (server) return server;
    const value = this.hostDraft().trim();
    if (!value) return this.transloco.translate('wsEmail.errors.required');
    if (!isValidSmtpHost(value)) return this.transloco.translate('wsEmail.errors.domain');
    return null;
  });

  private readonly rawUsernameError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors().smtpUsername;
    if (server) return server;
    const value = this.usernameDraft().trim();
    if (!value) return this.transloco.translate('wsEmail.errors.required');
    if (value.length > 320) return this.transloco.translate('wsEmail.errors.TENANT_EMAIL_CONFIG_INVALID');
    return null;
  });

  private readonly rawPasswordError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors().smtpPassword;
    if (server) return server;
    const value = this.passwordDraft();
    const required = this.switching() || !this.config()?.smtpPasswordConfigured;
    if (required && value.length === 0) {
      return this.transloco.translate('wsEmail.errors.passwordRequired');
    }
    if (value.length > 1024) {
      return this.transloco.translate('wsEmail.errors.TENANT_EMAIL_CONFIG_INVALID');
    }
    return null;
  });

  private readonly rawSecureError = computed(() => {
    this.i18n();
    const server = this.serverFieldErrors().smtpSecure;
    if (server) return server;
    if (this.protocolDraft() === 'smtps' && !this.secureDraft()) {
      return this.transloco.translate('wsEmail.errors.smtpsNeedsSecure');
    }
    return null;
  });

  protected readonly hostError = computed(() =>
    this.serverFieldErrors().smtpHost || this.submitted() || this.touched().smtpHost
      ? this.rawHostError()
      : null,
  );

  protected readonly portError = computed(() => this.serverFieldErrors().smtpPort ?? null);

  protected readonly usernameError = computed(() =>
    this.serverFieldErrors().smtpUsername || this.submitted() || this.touched().smtpUsername
      ? this.rawUsernameError()
      : null,
  );

  protected readonly protocolError = computed(() => this.serverFieldErrors().smtpProtocol ?? null);

  protected readonly passwordError = computed(() =>
    this.serverFieldErrors().smtpPassword || this.submitted() || this.touched().smtpPassword
      ? this.rawPasswordError()
      : null,
  );

  protected readonly secureError = computed(() =>
    this.serverFieldErrors().smtpSecure || this.submitted() || this.touched().smtpSecure
      ? this.rawSecureError()
      : null,
  );

  protected readonly isValid = computed(
    () =>
      !this.rawHostError() &&
      !this.rawUsernameError() &&
      !this.rawPasswordError() &&
      !this.rawSecureError(),
  );

  protected readonly canSubmit = computed(
    () => !this.isReadonly() && !this.busy() && (this.dirty() || this.switching()) && this.isValid(),
  );

  open(switching = false): void {
    const cfg = this.config();
    if (!cfg) return;
    this.allowClose = false;
    this.saveOp = null;
    this.switching.set(switching);

    const protocol: SmtpProtocol = cfg.smtpProtocol ?? 'smtp';
    const initial: SmtpBaseline = {
      smtpHost: cfg.smtpHost ?? '',
      smtpPort: cfg.smtpPort ?? 587,
      smtpUsername: cfg.smtpUsername ?? '',
      smtpProtocol: protocol,
      smtpSecure: protocol === 'smtps' ? true : (cfg.smtpSecure ?? true),
    };

    this.baseline.set(initial);
    this.applyBaseline(initial);
    this.modal().open();
  }

  close(): void {
    this.allowClose = true;
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.busy()) {
      this.modal().open();
      return;
    }
    this.allowClose = false;
    this.saveOp = null;
  }

  protected undo(): void {
    this.saveOp = null;
    this.applyBaseline(this.baseline());
  }

  protected markTouched(field: SmtpField): void {
    this.touched.update((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  protected onHostInput(event: Event): void {
    this.hostDraft.set((event.target as HTMLInputElement).value);
    this.onDraftChanged('smtpHost');
  }

  protected onHostBlur(): void {
    this.hostDraft.update((value) => value.trim().toLowerCase());
    this.markTouched('smtpHost');
  }

  protected onPortChange(value: SmtpPort): void {
    this.portDraft.set(value);
    this.onDraftChanged('smtpPort');
  }

  protected onUsernameInput(event: Event): void {
    this.usernameDraft.set((event.target as HTMLInputElement).value);
    this.onDraftChanged('smtpUsername');
  }

  protected onProtocolChange(value: SmtpProtocol): void {
    this.protocolDraft.set(value);
    if (value === 'smtps') {
      this.secureDraft.set(true);
      this.clearServerFieldError('smtpSecure');
    }
    this.onDraftChanged('smtpProtocol');
  }

  protected onPasswordInput(event: Event): void {
    this.passwordDraft.set((event.target as HTMLInputElement).value);
    this.onDraftChanged('smtpPassword');
  }

  protected onSecureChange(checked: boolean): void {
    if (this.protocolDraft() === 'smtps') {
      this.secureDraft.set(true);
      return;
    }
    this.secureDraft.set(checked);
    this.onDraftChanged('smtpSecure');
  }

  protected async runConnectionTest(): Promise<void> {
    if (!this.canTest()) return;
    this.probing.set(true);
    this.probeState.set('checking');
    this.probeError.set(null);

    try {
      await verifySmtpConnection(newIdempotencyKey());
      this.probeState.set('ok');
    } catch (error) {
      this.probeState.set('error');
      this.probeError.set(resolveEmailError(error, this.transloco));
    } finally {
      this.probing.set(false);
    }
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    const cfg = this.config();
    const rev = this.revision();
    if (!cfg || this.isReadonly() || this.busy()) return;
    if (!this.dirty() && !this.switching()) return;

    this.submitted.set(true);
    this.topError.set(null);
    this.serverFieldErrors.set({});

    if (!this.isValid()) return;

    const patch = this.buildPatch();
    if (Object.keys(patch).length === 0) return;

    const key = this.keyForPatch(patch);
    this.saving.set(true);

    try {
      const result = await patchEmailConfig(patch, rev ?? cfg.revision, key);
      this.saveOp = null;
      this.notify.success(this.transloco.translate('wsEmail.toast.saved'));
      this.saved.emit(result);
      this.close();
    } catch (error) {
      if (isConflictError(error)) {
        this.saveOp = null;
        this.close();
        this.conflict.emit({ status: error.status, patch });
        return;
      }

      const field = extractApiErrorField(error);
      const message = resolveEmailError(error, this.transloco);
      if (
        field === 'smtpHost' ||
        field === 'smtpPort' ||
        field === 'smtpUsername' ||
        field === 'smtpProtocol' ||
        field === 'smtpPassword' ||
        field === 'smtpSecure'
      ) {
        this.serverFieldErrors.set({ [field]: message });
      } else {
        this.topError.set(message);
      }
    } finally {
      this.saving.set(false);
    }
  }

  private buildPatch(): PatchEmailConfigRequest {
    const smtpHost = this.hostDraft().trim().toLowerCase();
    const smtpPort = this.portDraft();
    const smtpUsername = this.usernameDraft().trim();
    const smtpProtocol = this.protocolDraft();
    const smtpSecure = smtpProtocol === 'smtps' ? true : this.secureDraft();
    const smtpPassword = this.passwordDraft();

    if (this.switching()) {
      return {
        providerDriver: 'smtp',
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpProtocol,
        smtpUsername,
        smtpPassword,
      };
    }

    const base = this.baseline();
    const patch: PatchEmailConfigRequest = {};
    if (smtpHost !== base.smtpHost) patch.smtpHost = smtpHost;
    if (smtpPort !== base.smtpPort) patch.smtpPort = smtpPort;
    if (smtpUsername !== base.smtpUsername) patch.smtpUsername = smtpUsername;
    if (smtpProtocol !== base.smtpProtocol) patch.smtpProtocol = smtpProtocol;
    if (smtpSecure !== base.smtpSecure) patch.smtpSecure = smtpSecure;
    if (smtpPassword.length > 0) patch.smtpPassword = smtpPassword;

    if (Object.keys(patch).length > 0) {
      patch.smtpSecure = smtpSecure;
      patch.smtpProtocol = smtpProtocol;
    }

    return patch;
  }

  private applyBaseline(initial: SmtpBaseline): void {
    this.hostDraft.set(initial.smtpHost);
    this.portDraft.set(initial.smtpPort);
    this.usernameDraft.set(initial.smtpUsername);
    this.protocolDraft.set(initial.smtpProtocol);
    this.secureDraft.set(initial.smtpSecure);
    this.passwordDraft.set('');
    this.submitted.set(false);
    this.touched.set({});
    this.serverFieldErrors.set({});
    this.topError.set(null);
    this.probeState.set('idle');
    this.probeError.set(null);
  }

  private onDraftChanged(field: SmtpField): void {
    this.topError.set(null);
    this.probeState.set('idle');
    this.probeError.set(null);
    this.clearServerFieldError(field);
  }

  private clearServerFieldError(field: SmtpField): void {
    if (!this.serverFieldErrors()[field]) return;
    this.serverFieldErrors.update((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  private keyForPatch(patch: PatchEmailConfigRequest): string {
    const fp = JSON.stringify(patch);
    if (this.saveOp && this.saveOp.fingerprint === fp) {
      return this.saveOp.key;
    }
    const key = newIdempotencyKey();
    this.saveOp = { fingerprint: fp, key };
    return key;
  }
}
