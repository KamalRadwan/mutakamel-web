import type { BoardCardMove, MoveToTarget } from "@/design-system";
import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import type { PartyDocumentCountVisibility, PartyDocumentCounts } from "../../../shared/party-document-counts-contract";
import type { CustomerProfileCardPatch } from "../../customer-profile-card-contract";
import type { CustomerProfileBoardLane } from "../../hooks/useCustomerProfileBoard";
import type { CustomerProfileItem, CustomerProfileStatus } from "../../hooks/useCustomerProfiles";
export interface QuickCreateCustomerDraft {
  profileType: "INDIVIDUAL" | "CORPORATE";
  status: CustomerProfileStatus;
  acquisitionSourceId: string;
  firstName: string;
  lastName: string;
  phones: string[];
  companyName: string;
  companyPhones: string[];
  contactFirstName: string;
  contactLastName: string;
  contactPhones: string[];
}

export interface CustomerExecutiveBoardViewProps {
  items: readonly CustomerProfileItem[];
  statusTotals: ReadonlyMap<CustomerProfileStatus, number>;
  lanes: Record<string, CustomerProfileBoardLane>;
  loadingStatuses: ReadonlySet<string>;
  onLoadMoreStatus: (status: string) => void;
  branchId: string | null;
  sources?: ReadonlyArray<AcquisitionSource>;
  canCreate?: boolean;
  canUpdate: (item: CustomerProfileItem) => boolean;
  canDelete: (item: CustomerProfileItem) => boolean;
  onOpen: (item: CustomerProfileItem) => void;
  onOpenQuickModal?: (item: CustomerProfileItem) => void;
  onOpenFullCreate?: (
    status?: CustomerProfileStatus,
    draft?: QuickCreateCustomerDraft,
  ) => void;
  onDelete?: (item: CustomerProfileItem) => void;
  onOpenActivities?: (item: CustomerProfileItem) => void;
  onCardChange: (
    item: CustomerProfileItem,
    patch: CustomerProfileCardPatch,
  ) => void;
  onCardMove: (move: BoardCardMove) => void;
  onRefreshBoard?: () => void;
  documentCountsByParty?: ReadonlyMap<string, PartyDocumentCounts>;
  documentCountVisibility?: PartyDocumentCountVisibility;
}

export interface CustomerBoardQuickAddProps {
  status: CustomerProfileStatus;
  statusTitle: string;
  branchId: string;
  sources: ReadonlyArray<AcquisitionSource>;
  onCancel: () => void;
  onOpenFullModal: (draft: QuickCreateCustomerDraft) => void;
  onCreated: () => void;
}

export interface CustomerBoardCardProps {
  item: CustomerProfileItem;
  canUpdate: boolean;
  canDelete: boolean;
  moveTargets: readonly MoveToTarget[];
  onOpen: () => void;
  onOpenQuickModal?: () => void;
  onOpenActivities?: () => void;
  onDelete?: () => void;
  onMove: (status: string) => void;
  onCardChange: (patch: CustomerProfileCardPatch) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}
