import type { SupabaseClient } from "@supabase/supabase-js";
import { isPristine, mergeState, sameState } from "@/lib/merge";
import { SCHEMA_VERSION, migrate } from "@/lib/state";
import type { RecipityState } from "@/lib/types";

/**
 * Reading and writing the synced fridge.
 *
 * One row per user holding the whole state as a JSON document — we never query
 * inside it server-side, so a document is the right shape and keeps the schema
 * to a single table.
 *
 * Nothing here throws. Failures come back in the return value: sync is a
 * background nicety, and a flaky network must never take the app down or
 * block someone cooking.
 */

const TABLE = "kitchen_state";

export interface PullResult {
  /** The stored document exactly as it came back, or null if there is none. */
  raw: unknown;
  error: string | null;
}

export async function pullRemote(
  client: SupabaseClient,
  userId: string,
): Promise<PullResult> {
  try {
    const { data, error } = await client
      .from(TABLE)
      .select("state")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return { raw: null, error: error.message };
    // No row yet is the normal first-sign-in case, not a failure.
    return { raw: data?.state ?? null, error: null };
  } catch (err) {
    return { raw: null, error: err instanceof Error ? err.message : "pull failed" };
  }
}

export async function pushRemote(
  client: SupabaseClient,
  userId: string,
  state: RecipityState,
): Promise<{ error: string | null }> {
  try {
    const { error } = await client.from(TABLE).upsert(
      {
        user_id: userId,
        state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "push failed" };
  }
}

export interface SyncOutcome {
  /**
   * The reconciled state to adopt, or null when the round failed before one
   * could be worked out.
   */
  merged: RecipityState | null;
  /**
   * The local copy the merge was worked out against. If the device's state
   * is still this exact object, `merged` can replace it; if not, something
   * changed during the round and `merged` has to be folded in instead.
   */
  basis: RecipityState | null;
  /** Whether the server copy was written. */
  pushed: boolean;
  error: string | null;
}

const failed = (error: string): SyncOutcome => ({
  merged: null,
  basis: null,
  pushed: false,
  error,
});

/** Was this document written by a newer version of the app than this one? */
function fromTheFuture(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  return typeof version === "number" && version > SCHEMA_VERSION;
}

/**
 * One full round with the server: pull, merge, push.
 *
 * The order is the point. A device never writes without first reading and
 * folding in what is already there, so it cannot overwrite another device's
 * work — the old behaviour, where a failed first pull was followed by blind
 * pushes of the local copy, did exactly that.
 *
 * `readLocal` is called *after* the pull returns rather than passed in as a
 * value, so anything the user did while the request was in flight is part of
 * the merge.
 */
export async function syncOnce(
  client: SupabaseClient,
  userId: string,
  readLocal: () => RecipityState,
): Promise<SyncOutcome> {
  const pulled = await pullRemote(client, userId);
  if (pulled.error) return failed(pulled.error);

  const local = readLocal();

  if (pulled.raw === null) {
    // First round for this account. Don't create a row for a blank device.
    if (isPristine(local)) {
      return { merged: local, basis: local, pushed: false, error: null };
    }
    // Merging a state with itself changes nothing but its ordering, putting
    // it in the form every later merge produces — so the next round finds the
    // server already in agreement instead of rewriting it.
    const merged = mergeState(local, local);
    const pushed = await pushRemote(client, userId, merged);
    return { merged, basis: local, pushed: !pushed.error, error: pushed.error };
  }

  // A document from a newer version may hold things this version would drop
  // on the way back. Leave it alone rather than quietly downgrade it.
  if (fromTheFuture(pulled.raw)) {
    return failed("This device is running an older version. Reload to sync.");
  }

  const remote = migrate(pulled.raw);
  const merged = mergeState(local, remote);

  if (sameState(merged, remote)) {
    return { merged, basis: local, pushed: false, error: null };
  }

  const pushed = await pushRemote(client, userId, merged);
  return { merged, basis: local, pushed: !pushed.error, error: pushed.error };
}
