interface PipelineSafetyEntry {
  version: number;
  epoch: number;
  pending: symbol | null;
  unresolved: Set<string>;
  listeners: Set<() => void>;
}

// A modal or selected-preview remount must not erase an unresolved server write.
const entries = new Map<string, PipelineSafetyEntry>();

export function pipelineSafetyEntry(key: string): PipelineSafetyEntry {
  let entry = entries.get(key);
  if (!entry) {
    entry = { version: 0, epoch: 0, pending: null, unresolved: new Set(), listeners: new Set() };
    entries.set(key, entry);
  }
  return entry;
}

function changed(entry: PipelineSafetyEntry) {
  entry.version++;
  entry.listeners.forEach((listener) => listener());
}

export function acquirePipelineWrite(entry: PipelineSafetyEntry) {
  if (entry.pending || entry.unresolved.size) return null;
  const token = Symbol("pipeline-write");
  entry.pending = token;
  entry.epoch++;
  changed(entry);
  return token;
}

export function releasePipelineWrite(entry: PipelineSafetyEntry, token: symbol) {
  if (entry.pending !== token) return;
  entry.pending = null;
  changed(entry);
}

export function fencePipelineWrite(entry: PipelineSafetyEntry, token: symbol, resource: string) {
  if (entry.pending !== token) return;
  entry.unresolved.add(resource);
  entry.epoch++;
  changed(entry);
}

export function reconcilePipelineRead(entry: PipelineSafetyEntry, resource: string) {
  if (resource === "catalogue") entry.unresolved.clear();
  else {
    entry.unresolved.delete(resource);
    if (resource.startsWith("pipeline:")) entry.unresolved.delete(resource.replace("pipeline:", "assignments:"));
  }
  changed(entry);
}
