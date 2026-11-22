export interface RecordNavContext {
  ids: string[];
  total: number;
  loadMore: (() => Promise<string[]>) | null;
}

export interface RecordNavPosition {
  index: number;
  total: number;
}

export function navPosition(nav: RecordNavContext | null, id: string | null): RecordNavPosition | null {
  if (!nav || !id || nav.ids.length === 0) return null;
  const index = nav.ids.indexOf(id);
  if (index < 0) return null;
  const total = nav.loadMore ? Math.max(nav.total, nav.ids.length) : nav.ids.length;
  return { index: index + 1, total };
}

export async function nextNavTarget(
  nav: RecordNavContext | null,
  currentId: string | null,
  dir: -1 | 1,
): Promise<{ id: string; nav: RecordNavContext } | null> {
  if (!nav || !currentId) return null;
  const currentIdx = nav.ids.indexOf(currentId);
  if (currentIdx < 0) return null;

  const targetIndex = currentIdx + dir;
  if (dir === -1 && targetIndex < 0) return null;

  let navState: RecordNavContext = { ...nav, ids: [...nav.ids] };
  while (dir === 1 && targetIndex >= navState.ids.length) {
    if (!navState.loadMore || navState.ids.length >= navState.total) return null;
    const more = await navState.loadMore();
    const appended = more.filter((id) => !navState.ids.includes(id));
    if (appended.length === 0) return null;
    navState = { ...navState, ids: [...navState.ids, ...appended] };
  }

  if (targetIndex < 0 || targetIndex >= navState.ids.length) return null;
  return { id: navState.ids[targetIndex], nav: navState };
}
