"use client";

import { useEffect, useState } from "react";
import { readOwnerOptions } from "./readLeadOwnerOptions";
import { useTenantAuth } from "@/context/AuthContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { readCoreData } from "@/lib/api/envelope";
import { parseLeadTags, type LeadTag } from "../../lead-card-contract";
import { leadPath, type LeadDetail } from "../../lead-contract";
import { parseLeadDetailsUser, type LeadDetailsUser } from "../lead-details-edit-contract";

const USERS_PATH = "/api/tenant/core/v1/users";


export function useLeadDetailsReferences(lead: LeadDetail, editing: boolean, allowedOwnerIds: string[] | null) {
  const { user: actor } = useTenantAuth();
  const canReadUsers = actor?.permissions.includes("users.user.read") ?? false;
  const [names, setNames] = useState<LeadDetailsUser[]>([]);
  const [options, setOptions] = useState<LeadDetailsUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersUnavailable, setUsersUnavailable] = useState(false);
  const [tags, setTags] = useState<LeadTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [tagsUnavailable, setTagsUnavailable] = useState(false);

  useEffect(() => {
    if (!canReadUsers) return;
    const controller = new AbortController();
    const ids = [...new Set([lead.ownerUserId, lead.createdByUserId])].filter((id): id is string => Boolean(id && id !== actor?.id));
    void Promise.allSettled(ids.map((id) => readCoreData(`${USERS_PATH}/${encodeURIComponent(id)}`, { signal: controller.signal, cache: "no-store" }).then(parseLeadDetailsUser)))
      .then((results) => {
        if (controller.signal.aborted) return;
        setNames(results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []));
        setUsersUnavailable(results.some((result) => result.status === "rejected"));
      });
    return () => controller.abort();
  }, [actor?.id, canReadUsers, lead.ownerUserId, lead.createdByUserId]);

  useEffect(() => {
    if (!editing || !canReadUsers) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setUsersLoading(true);
      void readOwnerOptions(lead.branchId, controller.signal).then((next) => {
        if (!controller.signal.aborted) setOptions(next);
      }).catch(() => {
        if (!controller.signal.aborted) { setOptions([]); setUsersUnavailable(true); }
      }).finally(() => { if (!controller.signal.aborted) setUsersLoading(false); });
    });
    return () => controller.abort();
  }, [canReadUsers, editing, lead.branchId]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setTagsLoading(true);
      void axiosClient.get<unknown>(`${leadPath(lead.id)}/tags`, { signal: controller.signal, cache: "no-store", maxResponseBytes: 256 * 1024 }).then((response) => {
        // A missing/null list is a broken GET contract, not an empty tag set.
        if (!Array.isArray(response.data)) throw new Error("Invalid lead tags response.");
        const next = parseLeadTags(response.data);
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
  const candidates = [...options];
  if (actor?.status === "ACTIVE" && actor.accessibleBranches.includes(lead.branchId)) candidates.push(actor);
  const ownerOptions = [...new Map(candidates.map((user) => [user.id, user])).values()]
    .filter((user) => allowedOwnerIds === null || allowedOwnerIds.includes(user.id));
  return { actor, knownUsers: unique, ownerOptions, canReadUsers, usersLoading, usersUnavailable, tags, tagsLoading, tagsUnavailable };
}
