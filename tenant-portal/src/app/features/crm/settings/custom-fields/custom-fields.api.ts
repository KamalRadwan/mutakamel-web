import {
  fakeCreateCustomField,
  fakeListBranches,
  fakeListCustomFields,
  fakeListSampleRecords,
  fakeListValues,
  fakeSaveValue,
  fakeSetRequirement,
  fakeUpdateCustomField,
} from './custom-fields.fake';
import {
  CreatableOwnerType,
  CreateCustomFieldInput,
  CustomField,
  CustomFieldDefinition,
  CustomFieldValueRow,
  FieldRequirementRow,
  SampleBranch,
  SampleRecord,
  SaveCustomFieldValueInput,
  SetRequirementInput,
  UpdateCustomFieldPatch,
} from './custom-fields.model';

// GET /api/tenant/crm/v1/custom-fields
export function listCustomFields(): Promise<CustomField[]> {
  return fakeListCustomFields();
}

// POST /api/tenant/crm/v1/custom-fields
export function createCustomField(input: CreateCustomFieldInput): Promise<CustomFieldDefinition> {
  return fakeCreateCustomField(input);
}

// PATCH /api/tenant/crm/v1/custom-fields/:id
export function updateCustomField(id: string, patch: UpdateCustomFieldPatch): Promise<CustomFieldDefinition> {
  return fakeUpdateCustomField(id, patch);
}

// POST /api/tenant/crm/v1/custom-fields/:id/requirements
export function setRequirement(id: string, input: SetRequirementInput): Promise<FieldRequirementRow> {
  return fakeSetRequirement(id, input);
}

// GET /api/tenant/crm/v1/custom-fields/values
export function listValues(
  branchId: string,
  ownerType: CreatableOwnerType,
  ownerId: string,
): Promise<CustomFieldValueRow[]> {
  return fakeListValues(branchId, ownerType, ownerId);
}

// POST /api/tenant/crm/v1/custom-fields/values
export function saveValue(input: SaveCustomFieldValueInput): Promise<CustomFieldValueRow | null> {
  return fakeSaveValue(input);
}

// Sample branches for the Record values selector (fake until core branches endpoint is wired)
export function listBranches(): Promise<SampleBranch[]> {
  return fakeListBranches();
}

// Sample records for the Record values selector (fake until CRM record lookup endpoints are wired)
export function listSampleRecords(branchId: string, ownerType: CreatableOwnerType): Promise<SampleRecord[]> {
  return fakeListSampleRecords(branchId, ownerType);
}
