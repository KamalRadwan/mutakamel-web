import {
  ADDRESS_LABEL_MAX,
  ADDRESS_LINE_MAX,
  ADDRESS_PLACE_MAX,
  ADDRESS_POSTAL_MAX,
  ADDRESS_UNIT_MAX,
  CONTACT_LABEL_MAX,
  CONTACT_VALUE_MAX,
  RELATIONSHIP_LABEL_MAX,
  type AddressType,
  type ContactMethodType,
  type PartyAddress,
  type PartyContactMethod,
  type PartyRoleType,
  type RelationshipType,
} from "./directory-children-contract";

// Form values and the DTO bodies they become. A `PATCH` sends only the fields
// that actually moved: `forbidNonWhitelisted` means an unchanged key is not
// free, and re-sending a value the user did not touch would overwrite a
// concurrent edit.

export interface ContactMethodFormValues {
  methodType: ContactMethodType;
  value: string;
  label: string;
  isPrimary: boolean;
}

export const EMPTY_CONTACT_METHOD_FORM: ContactMethodFormValues = {
  methodType: "EMAIL",
  value: "",
  label: "",
  isPrimary: false,
};

export function toContactMethodForm(method: PartyContactMethod): ContactMethodFormValues {
  return {
    methodType: method.methodType,
    value: method.value,
    label: method.label ?? "",
    isPrimary: method.isPrimary,
  };
}

export function buildContactMethodCreate(
  values: ContactMethodFormValues,
): Record<string, unknown> {
  const value = values.value.trim();
  if (value.length === 0 || value.length > CONTACT_VALUE_MAX) {
    throw new Error("CONTACT_METHOD_FORM_VALUE");
  }
  const label = values.label.trim();
  return {
    methodType: values.methodType,
    value,
    ...(label ? { label: label.slice(0, CONTACT_LABEL_MAX) } : {}),
    ...(values.isPrimary ? { isPrimary: true } : {}),
  };
}

export function buildContactMethodUpdate(
  current: PartyContactMethod,
  values: ContactMethodFormValues,
): Record<string, unknown> {
  const value = values.value.trim();
  if (value.length === 0 || value.length > CONTACT_VALUE_MAX) {
    throw new Error("CONTACT_METHOD_FORM_VALUE");
  }
  const request: Record<string, unknown> = {};
  if (values.methodType !== current.methodType) request.methodType = values.methodType;
  if (value !== current.value) request.value = value;
  const label = values.label.trim();
  if (label !== (current.label ?? "")) request.label = label;
  if (values.isPrimary !== current.isPrimary) request.isPrimary = values.isPrimary;
  return request;
}

export interface AddressFormValues {
  addressType: AddressType;
  label: string;
  country: string;
  city: string;
  area: string;
  street: string;
  buildingNo: string;
  floor: string;
  apartment: string;
  landmark: string;
  postalCode: string;
  isPrimary: boolean;
}

export const EMPTY_ADDRESS_FORM: AddressFormValues = {
  addressType: "BILLING",
  label: "",
  country: "",
  city: "",
  area: "",
  street: "",
  buildingNo: "",
  floor: "",
  apartment: "",
  landmark: "",
  postalCode: "",
  isPrimary: false,
};

const ADDRESS_TEXT_MAX: Record<keyof Omit<AddressFormValues, "addressType" | "isPrimary">, number> =
  {
    label: ADDRESS_LABEL_MAX,
    country: ADDRESS_PLACE_MAX,
    city: ADDRESS_PLACE_MAX,
    area: ADDRESS_PLACE_MAX,
    street: ADDRESS_LINE_MAX,
    buildingNo: ADDRESS_UNIT_MAX,
    floor: ADDRESS_UNIT_MAX,
    apartment: ADDRESS_UNIT_MAX,
    landmark: ADDRESS_LINE_MAX,
    postalCode: ADDRESS_POSTAL_MAX,
  };

const ADDRESS_TEXT_KEYS = Object.keys(ADDRESS_TEXT_MAX) as Array<keyof typeof ADDRESS_TEXT_MAX>;

export function toAddressForm(address: PartyAddress): AddressFormValues {
  const form = { ...EMPTY_ADDRESS_FORM, addressType: address.addressType, isPrimary: address.isPrimary };
  for (const key of ADDRESS_TEXT_KEYS) form[key] = address[key] ?? "";
  return form;
}

export function buildAddressCreate(values: AddressFormValues): Record<string, unknown> {
  const request: Record<string, unknown> = { addressType: values.addressType };
  for (const key of ADDRESS_TEXT_KEYS) {
    const text = values[key].trim();
    if (text) request[key] = text.slice(0, ADDRESS_TEXT_MAX[key]);
  }
  if (values.isPrimary) request.isPrimary = true;
  return request;
}

export function buildAddressUpdate(
  current: PartyAddress,
  values: AddressFormValues,
): Record<string, unknown> {
  const request: Record<string, unknown> = {};
  if (values.addressType !== current.addressType) request.addressType = values.addressType;
  for (const key of ADDRESS_TEXT_KEYS) {
    const text = values[key].trim();
    if (text !== (current[key] ?? "")) request[key] = text.slice(0, ADDRESS_TEXT_MAX[key]);
  }
  if (values.isPrimary !== current.isPrimary) request.isPrimary = values.isPrimary;
  return request;
}

export interface RoleFormValues {
  roleType: PartyRoleType;
}

export const EMPTY_ROLE_FORM: RoleFormValues = { roleType: "CUSTOMER" };

/**
 * `branchId` is deliberately not offered: `CreatePartyRoleDto` accepts one, but
 * the service re-checks it against the actor's branch scope and answers
 * `BRANCH_PERMISSION_DENIED`, and this screen has no branch picker to make that
 * choice meaningful. A tenant-wide role is the honest default.
 */
export function buildRoleCreate(values: RoleFormValues): Record<string, unknown> {
  return { roleType: values.roleType };
}

export interface RelationshipFormValues {
  toPartyId: string;
  relationshipType: RelationshipType;
  label: string;
  isPrimary: boolean;
}

export const EMPTY_RELATIONSHIP_FORM: RelationshipFormValues = {
  toPartyId: "",
  relationshipType: "CONTACT_PERSON",
  label: "",
  isPrimary: false,
};

export function buildRelationshipCreate(
  fromPartyId: string,
  values: RelationshipFormValues,
): Record<string, unknown> {
  if (values.toPartyId.length === 0) throw new Error("RELATIONSHIP_FORM_TARGET");
  const label = values.label.trim();
  return {
    fromPartyId,
    toPartyId: values.toPartyId,
    relationshipType: values.relationshipType,
    ...(label ? { label: label.slice(0, RELATIONSHIP_LABEL_MAX) } : {}),
    ...(values.isPrimary ? { isPrimary: true } : {}),
  };
}
