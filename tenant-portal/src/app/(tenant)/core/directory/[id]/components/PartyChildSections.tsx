"use client";

import { Badge } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { Party } from "../../directory-contract";
import type { PartyAddress, PartyContactMethod, PartyRole } from "../../directory-children-contract";
import { usePartyChildren } from "../hooks/usePartyChildren";
import { usePartyRelationships } from "../hooks/usePartyRelationships";
import { AddRelationshipDrawer } from "./AddRelationshipDrawer";
import { AddRoleDrawer } from "./AddRoleDrawer";
import { AddressDrawer } from "./AddressDrawer";
import { ChildSection } from "./ChildSection";
import { ContactMethodDrawer } from "./ContactMethodDrawer";

interface PartyChildSectionsProps {
  party: Party;
  setParty: (updater: (current: Party | null) => Party | null) => void;
  grants: {
    canManageContacts: boolean;
    canManageAddresses: boolean;
    canManageRoles: boolean;
    canManageRelationships: boolean;
  };
}

export function PartyChildSections({ party, setParty, grants }: PartyChildSectionsProps) {
  const { t } = useI18n();
  const copy = t.coreOperations.directory;
  const { contactMethods, addresses, roles } = usePartyChildren(party, setParty, grants);
  const relationships = usePartyRelationships(party, grants.canManageRelationships);

  return (
    <>
      <ChildSection
        title={copy.contactsTitle}
        description={copy.contactsDescription}
        rows={contactMethods.items.map((method: PartyContactMethod) => ({
          id: method.id,
          primary: <span dir="ltr">{method.value}</span>,
          secondary: method.label ?? copy.contactTypes[method.methodType],
          trailing: (
            <span className="flex gap-1">
              <Badge tone="neutral">{copy.contactTypes[method.methodType]}</Badge>
              {method.isPrimary ? <Badge tone="brand">{copy.primaryBadge}</Badge> : null}
              {method.isVerified ? <Badge tone="positive">{copy.verifiedBadge}</Badge> : null}
            </span>
          ),
        }))}
        emptyTitle={copy.contactsEmpty}
        emptyDescription={copy.contactsEmptyDescription}
        addLabel={copy.contactCreate}
        canManage={contactMethods.canManage}
        readOnlyNotice={copy.contactsReadOnly}
        onAdd={contactMethods.openCreate}
        onEdit={(id) => {
          const method = contactMethods.items.find((item) => item.id === id);
          if (method) contactMethods.openEdit(method);
        }}
        onDelete={(id) => {
          const method = contactMethods.items.find((item) => item.id === id);
          if (method) contactMethods.openDelete(method);
        }}
        editLabel={copy.contactEditTitle}
        deleteLabel={t.common.delete}
        deleteTitle={copy.contactDeleteTitle}
        deleteDescription={copy.contactDeleteDescription}
        deletingId={contactMethods.deleting?.id ?? null}
        pendingId={contactMethods.pendingId}
        onConfirmDelete={() => void contactMethods.confirmDelete()}
        onCancelDelete={contactMethods.closeDelete}
      />

      <ChildSection
        title={copy.addressesTitle}
        description={copy.addressesDescription}
        rows={addresses.items.map((address: PartyAddress) => ({
          id: address.id,
          primary:
            [address.street, address.city, address.country].filter(Boolean).join(" · ") ||
            copy.addressTypes[address.addressType],
          secondary: address.label ?? copy.addressTypes[address.addressType],
          trailing: (
            <span className="flex gap-1">
              <Badge tone="neutral">{copy.addressTypes[address.addressType]}</Badge>
              {address.isPrimary ? <Badge tone="brand">{copy.primaryBadge}</Badge> : null}
            </span>
          ),
        }))}
        emptyTitle={copy.addressesEmpty}
        emptyDescription={copy.addressesEmptyDescription}
        addLabel={copy.addressCreate}
        canManage={addresses.canManage}
        readOnlyNotice={copy.addressesReadOnly}
        onAdd={addresses.openCreate}
        onEdit={(id) => {
          const address = addresses.items.find((item) => item.id === id);
          if (address) addresses.openEdit(address);
        }}
        onDelete={(id) => {
          const address = addresses.items.find((item) => item.id === id);
          if (address) addresses.openDelete(address);
        }}
        editLabel={copy.addressEditTitle}
        deleteLabel={t.common.delete}
        deleteTitle={copy.addressDeleteTitle}
        deleteDescription={copy.addressDeleteDescription}
        deletingId={addresses.deleting?.id ?? null}
        pendingId={addresses.pendingId}
        onConfirmDelete={() => void addresses.confirmDelete()}
        onCancelDelete={addresses.closeDelete}
      />

      <ChildSection
        title={copy.rolesTitle}
        description={copy.rolesDescription}
        rows={roles.items.map((role: PartyRole) => ({
          id: role.id,
          primary: copy.roleTypes[role.roleType],
          secondary: role.appSource ?? copy.roleTenantWide,
        }))}
        emptyTitle={copy.rolesEmpty}
        emptyDescription={copy.rolesEmptyDescription}
        addLabel={copy.roleCreate}
        canManage={roles.canManage}
        readOnlyNotice={copy.rolesReadOnly}
        onAdd={roles.openCreate}
        onDelete={(id) => {
          const role = roles.items.find((item) => item.id === id);
          if (role) roles.openDelete(role);
        }}
        deleteLabel={t.common.delete}
        deleteTitle={copy.roleDeleteTitle}
        deleteDescription={copy.roleDeleteDescription}
        deletingId={roles.deleting?.id ?? null}
        pendingId={roles.pendingId}
        onConfirmDelete={() => void roles.confirmDelete()}
        onCancelDelete={roles.closeDelete}
      />

      {relationships.isOrganization ? (
        <ChildSection
          title={copy.relationshipsTitle}
          description={copy.relationshipsDescription}
          rows={relationships.contacts.map((contact) => ({
            id: contact.relationshipId,
            primary: contact.displayName,
            secondary: [contact.email, contact.mobile, contact.phone].filter(Boolean).join(" · "),
            trailing: (
              <span className="flex gap-1">
                <Badge tone="neutral">{copy.relationshipTypes[contact.relationshipType]}</Badge>
                {contact.isPrimary ? <Badge tone="brand">{copy.primaryBadge}</Badge> : null}
              </span>
            ),
          }))}
          emptyTitle={copy.relationshipsEmpty}
          emptyDescription={copy.relationshipsEmptyDescription}
          addLabel={copy.relationshipCreate}
          canManage={grants.canManageRelationships}
          readOnlyNotice={copy.relationshipsReadOnly}
          onAdd={relationships.openCreate}
          onDelete={(id) => {
            const contact = relationships.contacts.find((item) => item.relationshipId === id);
            if (contact) relationships.openDelete(contact);
          }}
          deleteLabel={t.common.delete}
          deleteTitle={copy.relationshipDeleteTitle}
          deleteDescription={
            relationships.deleting
              ? formatTemplate(copy.relationshipDeleteDescription, {
                  name: relationships.deleting.displayName,
                })
              : copy.relationshipDeleteTitle
          }
          deletingId={relationships.deleting?.relationshipId ?? null}
          pendingId={relationships.pendingId}
          onConfirmDelete={() => void relationships.remove()}
          onCancelDelete={relationships.closeDelete}
          isLoading={relationships.isLoading}
          loadError={relationships.loadError}
          onRetry={relationships.reload}
          loadFailedTitle={copy.relationshipsLoadFailed}
        />
      ) : null}

      <ContactMethodDrawer
        key={contactMethods.editing?.id ?? "contact-create"}
        method={contactMethods.editing}
        isOpen={contactMethods.isCreateOpen || contactMethods.editing !== null}
        onClose={contactMethods.editing ? contactMethods.closeEdit : contactMethods.closeCreate}
        onSubmit={contactMethods.submit}
        isSubmitting={contactMethods.isSubmitting}
        error={contactMethods.formError}
      />

      <AddressDrawer
        key={addresses.editing?.id ?? "address-create"}
        address={addresses.editing}
        isOpen={addresses.isCreateOpen || addresses.editing !== null}
        onClose={addresses.editing ? addresses.closeEdit : addresses.closeCreate}
        onSubmit={addresses.submit}
        isSubmitting={addresses.isSubmitting}
        error={addresses.formError}
      />

      <AddRoleDrawer
        key={roles.isCreateOpen ? "role-open" : "role-closed"}
        isOpen={roles.isCreateOpen}
        onClose={roles.closeCreate}
        onSubmit={roles.submit}
        isSubmitting={roles.isSubmitting}
        error={roles.formError}
        assignedRoleTypes={roles.items.map((role) => role.roleType)}
      />

      <AddRelationshipDrawer
        key={relationships.isCreateOpen ? "relationship-open" : "relationship-closed"}
        isOpen={relationships.isCreateOpen}
        onClose={relationships.closeCreate}
        onSubmit={relationships.create}
        onSearch={(query) => void relationships.searchCandidates(query)}
        candidates={relationships.candidates}
        isSearching={relationships.isSearching}
        isSubmitting={relationships.isSubmitting}
        error={relationships.formError}
      />
    </>
  );
}
