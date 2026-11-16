import type { ReactNode } from "react";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { CustomFieldItem } from "../../../custom-fields/custom-field-contract";
import type { CrmFormErrors } from "../../../shared/hooks/useCrmCreateForm";
import type { OpportunityPipeline, OpportunityStage } from "../../hooks/pipeline-types";
import type { OpportunityForm } from "../../opportunity-write-contract";

export interface OpportunityFormOwner { id: string; displayName: string; avatarUrl?: string | null; disabled?: boolean }
export interface OpportunityFormContact {
  partyId: string; displayName: string; jobTitle: string | null; email: string | null;
  phones: string[]; isPrimary: boolean; disabled?: boolean;
}
interface OpportunityFormLead { id: string; displayName: string; summary?: string | null }
interface OpportunityFormLookups {
  owners: { items: OpportunityFormOwner[]; isLoading: boolean; error: NormalizedApiError | null; reload: () => void };
  customer: { contacts: OpportunityFormContact[]; sourceLeads: OpportunityFormLead[];
    item?: { id: string; displayName: string; companyName?: string | null; profileType?: string } | null;
    isLoading: boolean; error: NormalizedApiError | null; leadError?: NormalizedApiError | null; leadLoading?: boolean; reload: () => void };
}
interface OpportunityCustomerPicker {
  items: { id: string; displayName: string; companyName?: string | null; profileType?: string }[];
  selectedLabel: string;
  isLoading: boolean;
  error?: NormalizedApiError | null;
  onSearch: (search: string) => void;
  onSelect: (id: string, label: string) => void;
  reload?: () => void;
  hasMore?: boolean;
  loadMore?: () => void;
}
interface OpportunityFormCustomFields {
  definitions: CustomFieldItem[];
  requiredFieldKeys: readonly string[];
  loading?: boolean;
  degraded?: boolean;
}
export interface OpportunityFormCardsProps {
  form: OpportunityForm;
  errors: CrmFormErrors;
  onFieldChange: <K extends keyof OpportunityForm>(key: K, value: OpportunityForm[K]) => void;
  onBlur: (path: string) => void;
  disabled: boolean;
  view: "fast" | "full";
  mode: "create" | "edit";
  customers?: OpportunityCustomerPicker;
  lookups: OpportunityFormLookups;
  pipelines?: OpportunityPipeline[];
  selectableStages?: OpportunityStage[];
  onPipelineChange?: (id: string) => void;
  customFields: OpportunityFormCustomFields;
  currencyOptions?: string[];
  defaultOwnerId?: string;
  tagsSlot?: ReactNode;
  peopleContext?: ReactNode;
  pipelineSlot?: ReactNode;
  cardColorSlot?: ReactNode;
  readonlyCustomer?: ReactNode;
  readonlyLead?: ReactNode;
  selectedContactLabel?: string;
}
