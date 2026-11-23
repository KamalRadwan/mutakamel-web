import type { TenantMe } from '../../../../core/auth/auth-session.model';
import type { WorkspaceUser } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.model';

type Actor = Pick<WorkspaceUser, 'id' | 'firstName' | 'lastName' | 'email'>;

/** Names come only from the authenticated session or a Workspace user response. */
export function actorDisplayName(
  id: string | null | undefined,
  me: TenantMe | null,
  user: Actor | undefined,
  noneLabel: string,
): string {
  if (!id) return noneLabel;
  const actor = me?.id === id ? me : user?.id === id ? user : undefined;
  if (!actor) return noneLabel;
  return `${actor.firstName} ${actor.lastName}`.trim() || actor.email || noneLabel;
}
