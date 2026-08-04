import type { CanonicalArtworkRecord } from "@/lib/artwork/types";

export type CanonicalArtworkOrderingState = {
  records: CanonicalArtworkRecord[];
  seenAt: ReadonlyMap<string, number>;
  deletedAt: ReadonlyMap<string, number>;
};

export const EMPTY_ARTWORK_ORDERING_STATE: CanonicalArtworkOrderingState = {
  records: [],
  seenAt: new Map(),
  deletedAt: new Map(),
};

function sorted(records: Iterable<CanonicalArtworkRecord>) {
  return [...records].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
}

export function applyCanonicalArtworkRecord(
  current: CanonicalArtworkOrderingState,
  incoming: CanonicalArtworkRecord,
  sequence: number,
): CanonicalArtworkOrderingState {
  if ((current.deletedAt.get(incoming.id) ?? -1) > sequence) return current;
  const records = new Map(current.records.map((record) => [record.id, record]));
  const existing = records.get(incoming.id);
  if (existing && existing.version > incoming.version) return current;
  records.set(incoming.id, incoming);
  const seenAt = new Map(current.seenAt);
  seenAt.set(incoming.id, Math.max(sequence, seenAt.get(incoming.id) ?? -1));
  const deletedAt = new Map(current.deletedAt);
  if ((deletedAt.get(incoming.id) ?? -1) <= sequence) deletedAt.delete(incoming.id);
  return { records: sorted(records.values()), seenAt, deletedAt };
}

export function applyCanonicalArtworkSnapshot(
  current: CanonicalArtworkOrderingState,
  incoming: CanonicalArtworkRecord[],
  sequence: number,
): CanonicalArtworkOrderingState {
  let next = current;
  const incomingIds = new Set(incoming.map((record) => record.id));
  for (const record of incoming) next = applyCanonicalArtworkRecord(next, record, sequence);

  const records = new Map(next.records.map((record) => [record.id, record]));
  const seenAt = new Map(next.seenAt);
  const deletedAt = new Map(next.deletedAt);
  for (const record of current.records) {
    if (incomingIds.has(record.id)) continue;
    if ((current.seenAt.get(record.id) ?? -1) > sequence) continue;
    records.delete(record.id);
    seenAt.delete(record.id);
    deletedAt.set(record.id, Math.max(sequence, deletedAt.get(record.id) ?? -1));
  }
  return { records: sorted(records.values()), seenAt, deletedAt };
}
