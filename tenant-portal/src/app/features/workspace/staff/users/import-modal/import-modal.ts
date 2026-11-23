import { DOCUMENT } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { PluralKeyPipe } from '../../../../../core/i18n/plural';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerDownload, tablerUpload } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { ApiError } from '../../../../../core/api/api-errors';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { FileDrop } from '../../../../../shared/ui/file-drop/file-drop';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { newIdempotencyKey } from '../../shared/staff.api';
import { DryRunReport } from '../../../seats/dry-run-report/dry-run-report';
import { seatErrorMessage } from '../../../seats/seat-errors';
import { SEAT_PREVIEW } from '../../../seats/seats.api';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { StaffUsersApi, ImportBatchCreated, ImportBatchRow, ImportBatchRowStatus, InviteUserBody } from '../users.api';
import { SeatPreview } from '../../../seats/seats.model';
import { Branch, Company, Department, EMPLOYEE_CODE_PATTERN, Role, STAFF_LIMITS, Team } from '../../shared/staff.model';
import { EMAIL_PATTERN, resolveStaffError } from '../users-page/users.model';

type ImportMode = 'ALL_OR_NOTHING' | 'SKIP_ROLES_THAT_DONT_FIT';

const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_IMPORT_ROWS = 5000;
const TEMPLATE_COLUMNS = [
  'email',
  'firstName',
  'lastName',
  'employeeCode',
  'jobTitle',
  'companyCode',
  'branchCode',
  'departmentCode',
  'teamCode',
  'roleName',
] as const;

type ParsedImportRow = InviteUserBody;

function parseCsvRecords(rawText: string): string[][] {
  const text = rawText.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((v) => v.trim() !== '')) {
        records.push(row);
      }
      row = [];
    } else {
      cell += ch;
    }
  }

  row.push(cell);
  if (row.some((v) => v.trim() !== '')) {
    records.push(row);
  }
  return records;
}

/** An ALL_OR_NOTHING import row error carries the 0-based row as details.index: ['<n>']; null without it. */
export function importRowIndex(error: unknown): number | null {
  const raw = error instanceof ApiError ? error.details?.['index'] : undefined;
  return Array.isArray(raw) && typeof raw[0] === 'string' && /^\d+$/.test(raw[0]) ? Number(raw[0]) : null;
}

@Component({
  selector: 'app-import-modal',
  imports: [NgIcon, TranslocoPipe, PluralKeyPipe, Button, DryRunReport, Field, FileDrop, Modal, Segmented],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'staff', alias: 'staff' },
      { scope: 'staff-users', alias: 'users' },
      { scope: 'seats', alias: 'seats' },
    ),
    provideIcons({ tablerUpload, tablerDownload }),
  ],
  templateUrl: './import-modal.html',
})
export class ImportModal {
  private static nextId = 0;
  protected readonly uid = `import-modal-${++ImportModal.nextId}`;

  private readonly document = inject(DOCUMENT);
  private readonly api = inject(StaffUsersApi);
  private readonly tracker = inject(BulkJobsTracker);
  private readonly previewSeats = inject(SEAT_PREVIEW);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('modal');

  readonly companies = input<Company[]>([]);
  readonly branches = input<Branch[]>([]);
  readonly departments = input<Department[]>([]);
  readonly teams = input<Team[]>([]);
  readonly roles = input<Role[]>([]);

  readonly imported = output<void>();

  protected readonly maxBytes = MAX_IMPORT_BYTES;

  protected readonly fileName = signal('');
  protected readonly fileError = signal<string | null>(null);
  protected readonly parseErrors = signal<string[]>([]);
  protected readonly parsedRows = signal<ParsedImportRow[]>([]);
  protected readonly mode = signal<ImportMode>('ALL_OR_NOTHING');

  protected readonly checking = signal(false);
  protected readonly importing = signal(false);
  protected readonly dryRunResult = signal<SeatPreview | null>(null);
  protected readonly batch = signal<ImportBatchCreated | null>(null);
  protected readonly invalidRows = signal<ImportBatchRow[]>([]);
  protected readonly batchError = signal<string | null>(null);
  private readonly checked = signal(false);
  private checkedFingerprint: string | null = null;


  private lastFingerprint: string | null = null;
  private lastIdempotencyKey: string | null = null;

  protected readonly busy = computed(() => this.checking() || this.importing());

  protected readonly modeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'ALL_OR_NOTHING', label: this.transloco.translate('users.import.modeAll') },
      { value: 'SKIP_ROLES_THAT_DONT_FIT', label: this.transloco.translate('users.import.modeSkip') },
    ];
  });

  protected readonly canCheck = computed(
    () =>
      !this.busy() &&
      this.parsedRows().length > 0 &&
      this.parseErrors().length === 0,
  );

  protected readonly canImport = computed(() => {
    const batch = this.batch();
    const preview = this.dryRunResult();
    return !this.busy() && this.checked() && Boolean(batch?.valid) &&
      this.checkedFingerprint === this.fingerprint() &&
      (this.parsedRows().length > 500 || preview !== null && (preview.ok || this.mode() === 'SKIP_ROLES_THAT_DONT_FIT'));
  });

  constructor() {
    effect(() => {
      this.parsedRows();
      this.mode();
      untracked(() => this.clearBatch());
    });
  }

  open(): void {
    this.resetState();
    this.modal().open();
  }

  protected close(): void {
    if (this.busy()) return;
    this.modal().close();
  }

  protected onClosed(): void {
    this.resetState();
  }

  protected downloadTemplate(): void {
    const csv = `${TEMPLATE_COLUMNS.join(',')}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = 'users-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  protected async onFilePicked(file: File): Promise<void> {
    this.fileName.set(file.name);
    this.fileError.set(null);
    this.parseErrors.set([]);
    this.parsedRows.set([]);
    this.clearBatch();

    try {
      const content = await file.text();
      this.parseCsvContent(content);
    } catch {
      this.fileError.set(this.transloco.translate('users.import.fileHint'));
    }
  }

  protected onFileRejected(reason: 'type' | 'size'): void {
    this.clearBatch();
    this.parsedRows.set([]);
    this.parseErrors.set([]);
    this.fileError.set(
      reason === 'size' || reason === 'type'
        ? this.transloco.translate('users.import.fileHint')
        : null,
    );
  }

  protected onModeChange(value: string | null): void {
    if (this.busy()) return;
    if (value !== 'ALL_OR_NOTHING' && value !== 'SKIP_ROLES_THAT_DONT_FIT') return;
    if (value === this.mode()) return;
    this.mode.set(value);
    this.clearBatch();
  }

  protected async checkImport(): Promise<void> {
    if (!this.canCheck()) return;
    this.checking.set(true);
    this.batchError.set(null);
    this.checked.set(false);
    try {
      const body = {
        rows: this.parsedRows(),
        mode: this.mode() === 'ALL_OR_NOTHING' ? 'STRICT' as const : 'SKIP_ROLES_THAT_DONT_FIT' as const,
      };
      const batch = await this.api.createImportBatch(body, this.idempotencyKeyFor(body));
      this.batch.set(batch);
      this.invalidRows.set(batch.invalid ? await this.collectRows(batch.batchId, 'INVALID') : []);
      this.dryRunResult.set(this.parsedRows().length <= 500
        ? await this.previewSeats([{ kind: 'IMPORT', rows: this.parsedRows() }]) : null);
      this.checkedFingerprint = this.fingerprint();
      this.checked.set(true);
    } catch (error) {
      this.handleBatchError(error);
    } finally {
      this.checking.set(false);
    }
  }

  protected async runImport(): Promise<void> {
    if (!this.canImport()) return;
    const batch = this.batch()!;
    if (Date.parse(batch.expiresAt) <= Date.now()) {
      this.handleBatchError(new ApiError(410, 'IMPORT_BATCH_EXPIRED'));
      return;
    }
    this.importing.set(true);
    this.batchError.set(null);
    try {
      const rows = await this.collectRows(batch.batchId, 'VALID');
      if (!rows.length) throw new ApiError(422, 'IMPORT_BATCH_NO_VALID_ROWS');
      const body = {
        module: 'core.users', action: 'IMPORT', scope: {},
        selection: { kind: 'IDS' as const, ids: rows.map((row) => row.id) },
        params: {
          batchId: batch.batchId, confirmAddonCascade: false,
          skipRolesThatDontFit: this.mode() === 'SKIP_ROLES_THAT_DONT_FIT',
        },
      };
      await this.tracker.submit('core', body, { idempotencyKey: this.idempotencyKeyFor(body) });
      this.clearIdempotency();
      this.modal().close();
      this.imported.emit();
    } catch (error) {
      if (!(error instanceof ApiError && error.code === 'BULK_JOB_ACTIVE')) this.handleBatchError(error);
    } finally {
      this.importing.set(false);
    }
  }

  private async collectRows(batchId: string, status: ImportBatchRowStatus): Promise<ImportBatchRow[]> {
    const rows: ImportBatchRow[] = [];
    let page = 1;
    while (true) {
      const result = await this.api.listImportBatchRows(batchId, { status, page, limit: 100 });
      rows.push(...result.data);
      if (!result.meta.hasNext) return rows;
      page++;
    }
  }

  protected rowErrors(row: ImportBatchRow): string[] {
    this.i18n();
    return Object.entries(row.errors).flatMap(([field, messages]) =>
      messages.map((message) => {
        const key = `users.errors.${message}`;
        const translated = this.transloco.translate(key);
        return this.transloco.translate('users.import.rowError', {
          row: row.rowNo, message: `${field}: ${translated === key ? message : translated}`,
        });
      }),
    );
  }

  private handleBatchError(error: unknown): void {
    if (error instanceof ApiError && ['IMPORT_BATCH_EXPIRED', 'IMPORT_BATCH_NOT_FOUND'].includes(error.code)) {
      this.clearBatch();
      this.batchError.set(this.transloco.translate('users.import.recheck'));
    } else if (error instanceof ApiError && error.code === 'IMPORT_BATCH_ALREADY_SUBMITTED') {
      this.checked.set(false);
      this.batchError.set(this.transloco.translate(`users.errors.${error.code}`));
    } else if (error instanceof ApiError && error.code === 'IMPORT_BATCH_NO_VALID_ROWS') {
      this.checked.set(false);
      this.batchError.set(this.transloco.translate(`users.errors.${error.code}`));
    } else {
      this.notify.error(this.resolveError(error));
    }
  }

  private fingerprint(): string {
    return JSON.stringify([this.parsedRows(), this.mode()]);
  }

  private clearBatch(): void {
    this.batch.set(null);
    this.invalidRows.set([]);
    this.batchError.set(null);
    this.dryRunResult.set(null);
    this.checked.set(false);
    this.checkedFingerprint = null;
    this.clearIdempotency();
  }

  private parseCsvContent(content: string): void {
    this.clearBatch();
    const records = parseCsvRecords(content);
    if (records.length < 2) {
      this.parseErrors.set([this.transloco.translate('users.import.fileHint')]);
      return;
    }

    const headerCells = records[0].map((cell) => cell.trim());
    const colIndex = new Map<string, number>();
    headerCells.forEach((col, index) => {
      if (col) colIndex.set(col, index);
    });

    const dataRecords = records.slice(1);
    if (dataRecords.length > MAX_IMPORT_ROWS) {
      this.parseErrors.set([this.transloco.translate('users.import.fileHint')]);
      return;
    }

    const companyList = this.companies();
    const branchList = this.branches();
    const departmentList = this.departments();
    const teamList = this.teams();
    const roleList = this.roles();

    const errors: string[] = [];
    const rows: ParsedImportRow[] = [];

    const readCell = (record: string[], column: (typeof TEMPLATE_COLUMNS)[number]): string => {
      const idx = colIndex.get(column);
      return idx === undefined ? '' : (record[idx] ?? '').trim();
    };

    const rowError = (rowNum: number, message: string) => {
      errors.push(this.transloco.translate('users.import.parseError', { n: rowNum, message }));
    };

    const unknownCodeError = (rowNum: number, field: string, value: string) => {
      rowError(
        rowNum,
        this.transloco.translate('users.import.unknownCode', { field, value }),
      );
    };

    dataRecords.forEach((record, idx) => {
      const rowNum = idx + 1;
      const email = readCell(record, 'email').toLowerCase();
      const firstName = readCell(record, 'firstName');
      const lastName = readCell(record, 'lastName');
      const employeeCode = readCell(record, 'employeeCode');
      const jobTitle = readCell(record, 'jobTitle');
      const companyCode = readCell(record, 'companyCode');
      const branchCode = readCell(record, 'branchCode');
      const departmentCode = readCell(record, 'departmentCode');
      const teamCode = readCell(record, 'teamCode');
      const roleName = readCell(record, 'roleName');

      let rowHasError = false;

      if (!email) {
        rowError(rowNum, this.transloco.translate('users.validation.emailRequired'));
        rowHasError = true;
      } else if (Array.from(email).length > STAFF_LIMITS.email) {
        rowError(
          rowNum,
          this.transloco.translate('users.validation.emailMaxLength', { max: STAFF_LIMITS.email }),
        );
        rowHasError = true;
      } else if (!EMAIL_PATTERN.test(email)) {
        rowError(rowNum, this.transloco.translate('users.validation.emailInvalid'));
        rowHasError = true;
      }

      if (!firstName) {
        rowError(rowNum, this.transloco.translate('users.validation.firstNameRequired'));
        rowHasError = true;
      } else if (Array.from(firstName).length > STAFF_LIMITS.personName) {
        rowError(
          rowNum,
          this.transloco.translate('users.validation.firstNameMaxLength', { max: STAFF_LIMITS.personName }),
        );
        rowHasError = true;
      }

      if (!lastName) {
        rowError(rowNum, this.transloco.translate('users.validation.lastNameRequired'));
        rowHasError = true;
      } else if (Array.from(lastName).length > STAFF_LIMITS.personName) {
        rowError(
          rowNum,
          this.transloco.translate('users.validation.lastNameMaxLength', { max: STAFF_LIMITS.personName }),
        );
        rowHasError = true;
      }

      if (employeeCode && !EMPLOYEE_CODE_PATTERN.test(employeeCode)) {
        rowError(rowNum, this.transloco.translate('users.validation.codeInvalid'));
        rowHasError = true;
      }

      let company: Company | undefined;
      if (!companyCode) {
        rowError(rowNum, this.transloco.translate('users.validation.companyRequired'));
        rowHasError = true;
      } else {
        company = companyList.find(
          (c) => c.code.toLowerCase() === companyCode.toLowerCase(),
        );
        if (!company) {
          unknownCodeError(rowNum, 'companyCode', companyCode);
          rowHasError = true;
        }
      }

      let branch: Branch | undefined;
      if (!branchCode) {
        rowError(rowNum, this.transloco.translate('users.validation.branchRequired'));
        rowHasError = true;
      } else {
        branch = branchList.find(
          (b) =>
            (!company || b.companyId === company.id) &&
            b.code.toLowerCase() === branchCode.toLowerCase(),
        );
        if (!branch) {
          unknownCodeError(rowNum, 'branchCode', branchCode);
          rowHasError = true;
        }
      }

      let department: Department | undefined;
      if (!departmentCode) {
        rowError(rowNum, this.transloco.translate('users.validation.departmentRequired'));
        rowHasError = true;
      } else {
        department = departmentList.find(
          (d) =>
            (!branch || d.branchId === branch.id) &&
            d.code.toLowerCase() === departmentCode.toLowerCase(),
        );
        if (!department) {
          unknownCodeError(rowNum, 'departmentCode', departmentCode);
          rowHasError = true;
        }
      }

      let team: Team | undefined;
      if (teamCode) {
        team = teamList.find(
          (t) =>
            (!department || t.departmentId === department.id) &&
            t.code.toLowerCase() === teamCode.toLowerCase(),
        );
        if (!team) {
          unknownCodeError(rowNum, 'teamCode', teamCode);
          rowHasError = true;
        }
      }

      let role: Role | undefined;
      if (roleName) {
        const target = roleName.toLowerCase();
        role = roleList.find(
          (r) =>
            r.name !== 'Tenant Super Admin' &&
            r.nameI18n?.en !== 'Tenant Super Admin' &&
            (r.name.toLowerCase() === target ||
              r.nameI18n?.en?.toLowerCase() === target ||
              r.nameI18n?.ar?.toLowerCase() === target),
        );
        if (!role) {
          unknownCodeError(rowNum, 'roleName', roleName);
          rowHasError = true;
        }
      }

      if (!rowHasError && company && branch && department) {
        rows.push({
          email,
          firstName,
          lastName,
          ...(employeeCode ? { employeeCode } : {}),
          ...(jobTitle ? { jobTitle } : {}),
          companyId: company.id,
          branchId: branch.id,
          departmentId: department.id,
          ...(team ? { teamId: team.id } : {}),
          ...(role
            ? {
                roleAssignments: [{ branchId: branch.id, roleId: role.id }],
              }
            : {}),
        });
      }
    });

    this.parseErrors.set(errors);
    this.parsedRows.set(errors.length === 0 ? rows : []);
  }

  private resetState(): void {
    this.fileName.set('');
    this.fileError.set(null);
    this.parseErrors.set([]);
    this.parsedRows.set([]);
    this.mode.set('ALL_OR_NOTHING');
    this.clearBatch();
  }

  private idempotencyKeyFor(body: unknown): string {
    const fingerprint = `import:${JSON.stringify(body)}`;
    if (fingerprint !== this.lastFingerprint || !this.lastIdempotencyKey) {
      this.lastFingerprint = fingerprint;
      this.lastIdempotencyKey = newIdempotencyKey();
    }
    return this.lastIdempotencyKey;
  }

  private clearIdempotency(): void {
    this.lastFingerprint = null;
    this.lastIdempotencyKey = null;
  }

  private resolveError(error: unknown): string {
    const message = seatErrorMessage(this.transloco, error) ?? resolveStaffError(error, this.transloco);
    const index = importRowIndex(error);
    return index === null ? message : this.transloco.translate('users.import.rowError', { row: index + 1, message });
  }
}
