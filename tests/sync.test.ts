import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { DEFAULT_STAPLES } from "@/data/ingredients";
import { mergeState, sameState } from "@/lib/merge";
import { SCHEMA_VERSION, initialState, stampChanges } from "@/lib/state";
import { syncOnce } from "@/lib/sync";
import type { DietPrefs, RecipityState } from "@/lib/types";

/**
 * Sync, end to end, against a stand-in for the server: one row, read and
 * written whole, exactly as Supabase does it.
 *
 * The devices below behave the way `lib/store.tsx` does — stamp every change,
 * then pull, merge, push and adopt the result — so these tests cover the
 * whole path a real edit takes between two browsers, minus the network.
 */

/** Recursively sort keys, as Postgres `jsonb` does on the way out. */
function reorder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorder);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .reverse()
        .map((key) => [key, reorder((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

function fakeServer() {
  const server = {
    row: null as unknown,
    pulls: 0,
    pushes: 0,
    failPull: false,
    failPush: false,
    /** Runs between a pull resolving and its caller continuing. */
    afterPull: null as (() => void) | null,
    client: null as unknown as SupabaseClient,
  };

  server.client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            server.pulls += 1;
            if (server.failPull) {
              return { data: null, error: { message: "offline" } };
            }
            const data = server.row === null ? null : { state: server.row };
            server.afterPull?.();
            return { data, error: null };
          },
        }),
      }),
      upsert: async (payload: { state: unknown }) => {
        if (server.failPush) return { error: { message: "offline" } };
        server.pushes += 1;
        // Through JSON and back with keys reshuffled: what was sent is never
        // byte-for-byte what comes back.
        server.row = reorder(JSON.parse(JSON.stringify(payload.state)));
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient;

  return server;
}

let clock = Date.parse("2026-08-01T10:00:00.000Z");
/** Every action and sync happens a minute after the last. */
function tick(): string {
  clock += 60_000;
  return new Date(clock).toISOString();
}

function device(server: ReturnType<typeof fakeServer>, start = initialState()) {
  const d = {
    state: start,
    act(change: (s: RecipityState) => RecipityState) {
      d.state = stampChanges(d.state, change(d.state), tick());
    },
    async sync() {
      const outcome = await syncOnce(server.client, "user-1", () => d.state);
      if (outcome.merged) {
        // Exactly what the store does when a round comes back.
        d.state =
          d.state === outcome.basis
            ? outcome.merged
            : mergeState(d.state, outcome.merged);
      }
      return outcome;
    },
  };
  return d;
}

const add = (id: string) => (s: RecipityState) => ({
  ...s,
  pantry: [...s.pantry, { ingredientId: id, addedAt: new Date(clock).toISOString() }],
});
const remove = (id: string) => (s: RecipityState) => ({
  ...s,
  pantry: s.pantry.filter((p) => p.ingredientId !== id),
});
const setDiet = (diet: DietPrefs) => (s: RecipityState) => ({ ...s, diet });
const pantryOf = (d: { state: RecipityState }) =>
  d.state.pantry.map((p) => p.ingredientId).sort();

describe("syncOnce — one round", () => {
  it("does not create a row for a blank device", async () => {
    const server = fakeServer();
    const outcome = await device(server).sync();
    expect(outcome).toMatchObject({ pushed: false, error: null });
    expect(server.row).toBeNull();
  });

  it("uploads a device's fridge the first time", async () => {
    const server = fakeServer();
    const phone = device(server);
    phone.act(add("egg"));
    const outcome = await phone.sync();
    expect(outcome).toMatchObject({ pushed: true, error: null });
    expect(server.pushes).toBe(1);
  });

  it("writes nothing when the server already agrees", async () => {
    const server = fakeServer();
    const phone = device(server);
    phone.act(add("egg"));
    await phone.sync();
    const outcome = await phone.sync();
    // The row came back with its keys reshuffled and still counts as equal.
    expect(outcome.pushed).toBe(false);
    expect(server.pushes).toBe(1);
  });

  it("never pushes when the pull failed", async () => {
    // The old behaviour was to carry on pushing the local copy after a failed
    // first pull, overwriting whatever the account held.
    const server = fakeServer();
    const laptop = device(server);
    laptop.act(add("rice"));
    await laptop.sync();

    const phone = device(server);
    phone.act(add("egg"));
    server.failPull = true;
    const outcome = await phone.sync();

    expect(outcome).toMatchObject({ merged: null, pushed: false, error: "offline" });
    expect(server.pushes).toBe(1);

    // Back online, the round completes and nobody's work was lost.
    server.failPull = false;
    await phone.sync();
    expect(pantryOf(phone)).toEqual(["egg", "rice"]);
  });

  it("reports a failed push but still hands back the merge", async () => {
    const server = fakeServer();
    const laptop = device(server);
    laptop.act(add("rice"));
    await laptop.sync();

    const phone = device(server);
    phone.act(add("egg"));
    server.failPush = true;
    const outcome = await phone.sync();

    expect(outcome.error).toBe("offline");
    expect(outcome.pushed).toBe(false);
    // The server's news still arrived locally; the push is retried later.
    expect(pantryOf(phone)).toEqual(["egg", "rice"]);
  });

  it("leaves a document from a newer version alone", async () => {
    const server = fakeServer();
    server.row = { ...initialState(), schemaVersion: SCHEMA_VERSION + 1, shinyNewField: 1 };
    const phone = device(server);
    phone.act(add("egg"));
    const outcome = await phone.sync();

    expect(outcome.error).toMatch(/older version/);
    expect(server.pushes).toBe(0);
    expect((server.row as { shinyNewField?: number }).shinyNewField).toBe(1);
  });

  it("merges against what the device holds when the pull returns", async () => {
    // Something typed while the request was in flight must be part of the
    // merge, not overwritten by it.
    const server = fakeServer();
    const laptop = device(server);
    laptop.act(add("rice"));
    await laptop.sync();

    const phone = device(server);
    server.afterPull = () => {
      server.afterPull = null;
      phone.act(add("egg"));
    };
    await phone.sync();
    expect(pantryOf(phone)).toEqual(["egg", "rice"]);
    expect(
      (server.row as RecipityState).pantry.map((p) => p.ingredientId).sort(),
    ).toEqual(["egg", "rice"]);
  });
});

describe("two devices on one account", () => {
  async function pair() {
    const server = fakeServer();
    const phone = device(server);
    const laptop = device(server);
    phone.act(add("egg"));
    phone.act(add("spinach"));
    await phone.sync();
    await laptop.sync();
    return { server, phone, laptop };
  }

  it("carries a fridge to a second device", async () => {
    const { laptop } = await pair();
    expect(pantryOf(laptop)).toEqual(["egg", "spinach"]);
  });

  it("carries a deletion to the device that still had the item", async () => {
    const { phone, laptop } = await pair();
    laptop.act(remove("spinach"));
    await laptop.sync();
    await phone.sync();
    expect(pantryOf(phone)).toEqual(["egg"]);
    expect(pantryOf(laptop)).toEqual(["egg"]);
  });

  it("does not bring it back when the stale device syncs first", async () => {
    // The order that used to resurrect it: the phone, still holding spinach,
    // pushes its copy before it has heard about the deletion.
    const { phone, laptop } = await pair();
    laptop.act(remove("spinach"));
    phone.act(add("rice"));
    await phone.sync();
    await laptop.sync();
    await phone.sync();
    expect(pantryOf(phone)).toEqual(["egg", "rice"]);
    expect(pantryOf(laptop)).toEqual(["egg", "rice"]);
  });

  it("carries an emptied fridge", async () => {
    const { phone, laptop } = await pair();
    laptop.act((s) => ({ ...s, pantry: [] }));
    await laptop.sync();
    await phone.sync();
    expect(pantryOf(phone)).toEqual([]);
  });

  it("lets something deleted on one device be bought again on the other", async () => {
    const { phone, laptop } = await pair();
    laptop.act(remove("spinach"));
    await laptop.sync();
    await phone.sync();
    phone.act(add("spinach"));
    await phone.sync();
    await laptop.sync();
    expect(pantryOf(laptop)).toEqual(["egg", "spinach"]);
  });

  it("keeps a diet rule through an unrelated edit on a device that hadn't heard", async () => {
    const { phone, laptop } = await pair();
    phone.act(setDiet({ restrictions: ["nutFree"], avoid: ["peanuts"] }));
    await phone.sync();

    // The laptop hasn't synced since, and now makes the newest change of all.
    laptop.act(add("rice"));
    await laptop.sync();
    await phone.sync();

    for (const d of [phone, laptop]) {
      expect(d.state.diet).toEqual({ restrictions: ["nutFree"], avoid: ["peanuts"] });
    }
  });

  it("carries an unticked staple and keeps it unticked", async () => {
    const { phone, laptop } = await pair();
    phone.act((s) => ({ ...s, staples: s.staples.filter((id) => id !== "rice") }));
    await phone.sync();
    laptop.act(add("tofu"));
    await laptop.sync();
    await phone.sync();
    expect(laptop.state.staples).not.toContain("rice");
    expect(phone.state.staples).not.toContain("rice");
    expect(phone.state.staples).toHaveLength(DEFAULT_STAPLES.length - 1);
  });

  it("settles: once both have synced, further rounds write nothing", async () => {
    const { server, phone, laptop } = await pair();
    laptop.act(remove("spinach"));
    phone.act(add("rice"));
    phone.act(setDiet({ restrictions: ["vegetarian"], avoid: [] }));
    await phone.sync();
    await laptop.sync();
    await phone.sync();

    const before = server.pushes;
    for (let round = 0; round < 3; round += 1) {
      await phone.sync();
      await laptop.sync();
    }
    expect(server.pushes).toBe(before);
    expect(sameState(phone.state, laptop.state)).toBe(true);
  });
});

describe("an account last written by the previous version", () => {
  it("merges with it and keeps what was unticked there", async () => {
    const server = fakeServer();
    server.row = {
      schemaVersion: 2,
      updatedAt: "2026-07-01T10:00:00.000Z",
      pantry: [{ ingredientId: "egg", addedAt: "2026-07-01T10:00:00.000Z" }],
      staples: DEFAULT_STAPLES.filter((id) => id !== "rice"),
      favorites: ["dal"],
      history: [],
      shoppingList: [],
      diet: { restrictions: ["nutFree"], avoid: [] },
      invented: [],
    };

    // A fresh device, with rice still ticked by default.
    const phone = device(server);
    phone.act(add("spinach"));
    await phone.sync();

    expect(pantryOf(phone)).toEqual(["egg", "spinach"]);
    expect(phone.state.staples).not.toContain("rice");
    expect(phone.state.diet.restrictions).toEqual(["nutFree"]);
    expect(phone.state.favorites).toEqual(["dal"]);
    // And the account is now stored in the current format.
    expect((server.row as RecipityState).schemaVersion).toBe(SCHEMA_VERSION);
  });
});
