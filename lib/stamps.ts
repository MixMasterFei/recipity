import type { StampMap, SyncMeta } from "@/lib/types";

/**
 * Timestamp helpers shared by `lib/state.ts` (which writes stamps as the user
 * acts) and `lib/merge.ts` (which reads them to reconcile two devices).
 */

/** The start of time: what a missing or legacy stamp is treated as. */
export const EPOCH = new Date(0).toISOString();

/**
 * Milliseconds for an ISO stamp. Missing or unparseable stamps sort oldest,
 * so a corrupt timestamp can never win against a good one.
 */
export function timeOf(iso: string | undefined): number {
  if (iso === undefined) return 0;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/** The later of two stamps, or undefined if there are none. */
export function later(
  a: string | undefined,
  b: string | undefined,
): string | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return timeOf(a) >= timeOf(b) ? a : b;
}

export function emptySync(): SyncMeta {
  return {
    added: { favorites: {}, staples: {}, restrictions: {}, avoid: {} },
    removed: {
      pantry: {},
      shoppingList: {},
      invented: {},
      favorites: {},
      staples: {},
      restrictions: {},
      avoid: {},
    },
  };
}

/** A copy safe to mutate without touching the state it came from. */
export function cloneSync(sync: SyncMeta): SyncMeta {
  return {
    added: {
      favorites: { ...sync.added.favorites },
      staples: { ...sync.added.staples },
      restrictions: { ...sync.added.restrictions },
      avoid: { ...sync.added.avoid },
    },
    removed: {
      pantry: { ...sync.removed.pantry },
      shoppingList: { ...sync.removed.shoppingList },
      invented: { ...sync.removed.invented },
      favorites: { ...sync.removed.favorites },
      staples: { ...sync.removed.staples },
      restrictions: { ...sync.removed.restrictions },
      avoid: { ...sync.removed.avoid },
    },
  };
}

/**
 * How many removal markers one collection keeps.
 *
 * Most are bounded by the catalogue anyway (you can only remove ~470 distinct
 * ingredients). Invented recipes are the exception — every one has a fresh id
 * — so the oldest markers are dropped past this point. A marker that old only
 * matters to a device that hasn't synced since, and the worst it can do is
 * bring back one long-deleted invention.
 */
const MAX_MARKERS = 1000;

/** Drop the oldest markers once a map outgrows the cap. Mutates `map`. */
export function capMarkers(map: StampMap): void {
  const keys = Object.keys(map);
  if (keys.length <= MAX_MARKERS) return;
  keys
    .sort((a, b) => timeOf(map[b]) - timeOf(map[a]))
    .slice(MAX_MARKERS)
    .forEach((key) => {
      delete map[key];
    });
}

/** True when nothing has ever been stamped: no adds, no removals. */
export function isUnstamped(sync: SyncMeta): boolean {
  const empty = (map: StampMap) => Object.keys(map).length === 0;
  return (
    Object.values(sync.added).every(empty) &&
    Object.values(sync.removed).every(empty)
  );
}
