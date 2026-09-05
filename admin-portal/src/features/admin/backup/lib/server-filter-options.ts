/** Radix refuses an empty SelectItem value, so "all" needs a sentinel. */
export const ALL_SERVERS = "__all__";

export interface ServerFilterOption {
  value: string;
  label: string;
}

/**
 * Builds the server filter's options, always leading with "all servers".
 *
 * FE-BK02. The list used to hold only concrete server ids, so "all servers"
 * existed as the trigger's placeholder for the empty state and as nothing else.
 * Once the operator picked a server there was no option to go back, and the
 * only way to widen the view again was to reload the page - on a screen whose
 * whole purpose is narrowing down a list of backup artifacts.
 */
export function serverFilterOptions(
  servers: readonly { id: string; name: string }[],
  allServersLabel: string,
): ServerFilterOption[] {
  return [
    { value: ALL_SERVERS, label: allServersLabel },
    ...servers.map((server) => ({ value: server.id, label: server.name })),
  ];
}

/** The stored filter value shown in the trigger; empty means all. */
export function serverFilterValue(databaseServerId: string): string {
  return databaseServerId || ALL_SERVERS;
}

/** The selected option translated back into the stored filter. */
export function serverFilterSelection(value: string): string {
  return value === ALL_SERVERS ? "" : value;
}
