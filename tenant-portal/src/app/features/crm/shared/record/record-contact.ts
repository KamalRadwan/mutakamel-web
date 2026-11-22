export interface ContactDraft {
  key: string;
  contactPartyId: string | null;
  honorificTitle: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  isPrimary: boolean;
  phones: string[];
  email: string;
}

export interface ContactLimits {
  honorificTitle: number;
  firstName: number;
  lastName: number;
  jobTitle: number;
  email: number;
  phones: number;
  phoneLength: number;
  contacts: number;
}

export interface CompanyContactOption {
  partyId: string;
  displayName: string;
  jobTitle: string | null;
  email: string | null;
  phones: string[];
}

export type ContactErrors = Record<string, string>;

export type ContactChange =
  | { op: 'ADD'; contact: ContactDraft }
  | { op: 'UPDATE'; contactPartyId: string; contact: ContactDraft }
  | { op: 'REMOVE'; contactPartyId: string }
  | { op: 'SET_PRIMARY'; contactPartyId: string };

function newContactKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `contact-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newContact(isPrimary = false): ContactDraft {
  return {
    key: newContactKey(),
    contactPartyId: null,
    honorificTitle: '',
    firstName: '',
    lastName: '',
    jobTitle: '',
    isPrimary,
    phones: [''],
    email: '',
  };
}
