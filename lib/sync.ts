import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecipityState } from "@/lib/types";

/**
 * Reading and writing the synced fridge.
 *
 * One row per user holding the whole state as a JSON document — we never query
 * inside it server-side, so a document is the right shape and keeps the schema
 * to a single table.
 *
 * Both functions swallow failures and report them in the return value rather
 * than throwing. Sync is a background nicety; a flaky network must never take
 * the app down or block someone cooking.
 */

const TABLE = "kitchen_state";

export interface PullResult {
  state: RecipityState | null;
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

    if (error) return { state: null, error: error.message };
    // No row yet is the normal first-sign-in case, not a failure.
    if (!data?.state) return { state: null, error: null };

    return { state: data.state as RecipityState, error: null };
  } catch (err) {
    return { state: null, error: err instanceof Error ? err.message : "pull failed" };
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
