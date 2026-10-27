"use client";

import { useEffect, useState } from "react";
import { readAssignableLeadOwners } from "./readLeadOwnerOptions";
import { useTenantAuth } from "@/context/AuthContext";
import { useOrganizationScopeHeaders } from "@/hooks/useOrganizationScope";
import { axiosClient } from "@/lib/api/axiosClient";
import { readCoreData } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import { parseCrmTags, type CrmTag } from "../../../shared/tag-contract";
import { leadPath, type LeadDetail } from "../../lead-contract";
import { parseLeadDetailsUser, type LeadDetailsUser } from "../lead-details-edit-contract";

const USERS_PATH = "/api/tenant/core/v1/users";


export function useLeadDetailsReferences(lead: LeadDetail, editing: boolean, allowedOwnerIds: string[] | null) {
  const { user: actor } = useTenantAuth();
  const scope = useOrganizationScopeHeaders("BRANCH_REQUIRED", lead.branchId);
  const canReadUsers = actor?.permissions.includes("users.user.read") ?? false;
  const [names, setNames] = useState<LeadDetailsUser[]>([]);
  const [ownerPage, setOwnerPage] = useState<{ branchId: string; items: LeadDetailsUser[] } | null>(null);
  const options = scope.ready && ownerPage?.branchId === lead.branchId ? ownerPage.items : [];
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersUnavailable, setUsersUnavailable] = useState(false);
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [tagsUnavailable, setTagsUnavailable] = useState(false);

  useEffect(() => {
    if (!canReadUsers) return;
    const controller = new AbortController();
    const ids = [...new Set([lead.ownerUserId, lead.createdByUserId])].filter((id): id is string => Boolean(id && isUUIDv7(id) && id !== actor?.id));
    if (ids.length === 0) return;
    void Promise.allSettled(ids.map((id) => readCoreData(`${USERS_PATH}/${encodeURIComponent(id)}`, { signal: controller.signal, cache: "no-store" }).then(parseLeadDetailsUser)))
      .then((results) => {
        if (controller.signal.aborted) return;
        setNames(results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []));
      });
    return () => controller.abort();
  }, [actor?.id, canReadUsers, lead.ownerUserId, lead.createdByUserId]);

  useEffect(() => {
    if (!editing || !isUUIDv7(lead.branchId) || !scope.ready) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setUsersLoading(true);
      setOwnerPage(null);
      setUsersUnavailable(false);
      void readAssignableLeadOwners(lead.branchId, "update", controller.signal, scope.headers).then((next) => {
        if (!controller.signal.aborted) setOwnerPage({ branchId: lead.branchId, items: next });
      }).catch(() => {
        if (!controller.signal.aborted) { setOwnerPage(null); setUsersUnavailable(true); }
      }).finally(() => { if (!controller.signal.aborted) setUsersLoading(false); });
    });
    return () => controller.abort();
  }, [editing, lead.branchId, scope]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!isUUIDv7(lead.id)) {
        setTags([]);
        setTagsLoading(false);
        setTagsUnavailable(false);
        return;
      }
      setTagsLoading(true);
      void axiosClient.get<unknown>(`${leadPath(lead.id)}/tags`, { signal: controller.signal, cache: "no-store", maxResponseBytes: 256 * 1024 }).then((response) => {
        // A missing/null list is a broken GET contract, not an empty tag set.
        if (!Array.isArray(response.data)) throw new Error("Invalid lead tags response.");
        const next = parseCrmTags(response.data);
        if (!controller.signal.aborted) { setTags(next); setTagsUnavailable(false); }
      }).catch(() => {
        if (!controller.signal.aborted) { setTags([]); setTagsUnavailable(true); }
      }).finally(() => { if (!controller.signal.aborted) setTagsLoading(false); });
    });
    return () => controller.abort();
  }, [lead.id, lead.updatedAt]);

  const knownUsers = [...names, ...options];
  if (actor) knownUsers.push({ id: actor.id, firstName: actor.firstName, lastName: actor.lastName });
  const unique = new Map(knownUsers.map((user) => [user.id, user]));
  const ownerOptions = options
    .filter((user) => allowedOwnerIds === null || allowedOwnerIds.includes(user.id));
  return { actor, knownUsers: unique, ownerOptions, canReadUsers, usersLoading, usersUnavailable, tags, tagsLoading, tagsUnavailable };
}
