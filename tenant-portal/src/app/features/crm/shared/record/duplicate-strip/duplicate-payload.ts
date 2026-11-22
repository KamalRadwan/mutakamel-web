import { DuplicateCheckPayload, DuplicateProbe } from './duplicate.model';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** LeadDuplicateCheckDto limits: a probe past them would be a 400, so it is left out instead. */
export const DUPLICATE_CHECK_LIMITS = {
  name: 200,
  phones: 10,
  phoneLength: 40,
  email: 180,
  taxNumber: 64,
  commercialRegistrationNumber: 64,
} as const;

const TWO_DIGIT_DIAL_CODES = new Set([
  '20', '27',
  '30', '31', '32', '33', '34', '36', '39',
  '40', '41', '43', '44', '45', '46', '47', '48', '49',
  '51', '52', '53', '54', '55', '56', '57', '58',
  '60', '61', '62', '63', '64', '65', '66',
  '81', '82', '84', '86',
  '90', '91', '92', '93', '94', '95', '98',
]);

function stripDialCode(digits: string): string {
  if (digits.startsWith('1') || digits.startsWith('7')) {
    return digits.slice(1);
  }
  if (TWO_DIGIT_DIAL_CODES.has(digits.slice(0, 2))) {
    return digits.slice(2);
  }
  return digits.slice(3);
}

function phoneLocalDigits(raw: string): number {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return 0;
  if (trimmed.startsWith('+')) {
    return stripDialCode(digits).length;
  }
  if (digits.startsWith('00') && digits.length > 2) {
    return stripDialCode(digits.slice(2)).length;
  }
  return digits.length;
}

export function buildPayload(probe: DuplicateProbe | null): DuplicateCheckPayload | null {
  if (!probe) return null;
  const branchId = probe.branchId?.trim() ?? '';
  if (!branchId) return null;

  const payload: DuplicateCheckPayload = { branchId };
  let meaningful = false;

  const name = probe.name.trim();
  if (name.length >= 3 && name.length <= DUPLICATE_CHECK_LIMITS.name) {
    payload.name = name;
    meaningful = true;
  }

  const phones = (probe.phones ?? [])
    .map((phone) => phone.trim())
    .filter((phone) => phone.length <= DUPLICATE_CHECK_LIMITS.phoneLength && phoneLocalDigits(phone) >= 5)
    .slice(0, DUPLICATE_CHECK_LIMITS.phones);
  if (phones.length > 0) {
    payload.phones = phones;
    meaningful = true;
  }

  const email = probe.email.trim();
  if (email.length <= DUPLICATE_CHECK_LIMITS.email && EMAIL_PATTERN.test(email)) {
    payload.email = email;
    meaningful = true;
  }

  const taxNumber = probe.taxNumber.trim();
  if (taxNumber.length >= 3 && taxNumber.length <= DUPLICATE_CHECK_LIMITS.taxNumber) {
    payload.taxNumber = taxNumber;
    meaningful = true;
  }

  const commercialRegistrationNumber = probe.commercialRegistrationNumber.trim();
  if (
    commercialRegistrationNumber.length >= 3 &&
    commercialRegistrationNumber.length <= DUPLICATE_CHECK_LIMITS.commercialRegistrationNumber
  ) {
    payload.commercialRegistrationNumber = commercialRegistrationNumber;
    meaningful = true;
  }

  if (!meaningful) return null;

  const ownerUserId = probe.ownerUserId?.trim();
  if (ownerUserId) {
    payload.ownerUserId = ownerUserId;
  }

  const excludePartyId = probe.excludePartyId?.trim();
  if (excludePartyId) {
    payload.excludePartyId = excludePartyId;
  }

  return payload;
}
