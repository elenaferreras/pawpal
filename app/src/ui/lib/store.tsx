import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Database } from "../types";
import { defaultDatabase, loadDatabase, migrateDatabase, persistDatabase } from "./storage";
import { resolveMembership } from "./coowner";
import {
  getDataOwner,
  getRowKey,
  setDataOwner,
  syncFromSupabase,
} from "./supabase";

interface DbContextValue {
  db: Database;
  /** Apply a mutation to a draft copy of the database, then persist + re-render. */
  update: (mutate: (draft: Database) => void) => void;
  /** Replace the entire database (used by cloud pull / clear-all). */
  replace: (next: Database) => void;
  /** Live getter, for interval-based checks that must see the latest state. */
  getDb: () => Database;
}

const DbContext = createContext<DbContextValue | null>(null);

export function DbProvider({ children }: { children: ReactNode }): ReactNode {
  const [db, setDb] = useState<Database>(loadDatabase);
  const ref = useRef(db);
  ref.current = db;

  const update = useCallback((mutate: (draft: Database) => void) => {
    setDb((current) => {
      const draft = structuredClone(current);
      mutate(draft);
      persistDatabase(draft);
      ref.current = draft;
      return draft;
    });
  }, []);

  const replace = useCallback((next: Database) => {
    // Normalise any legacy-shape walks brought in by a cloud pull / snapshot.
    migrateDatabase(next);
    persistDatabase(next);
    ref.current = next;
    setDb(next);
  }, []);

  const getDb = useCallback(() => ref.current, []);

  // Keep the on-device data scoped to the signed-in identity. When you switch
  // accounts (or sign out) on the same device, reconcile the local database to
  // the new identity so one account's data never leaks into another's cloud
  // row (which the dog-sitter invites read from).
  useEffect(() => {
    // On first mount, claim the current local data for the current identity so
    // an existing install keeps syncing normally.
    if (getDataOwner() === null) setDataOwner(getRowKey());

    const reconcile = async (): Promise<void> => {
      // Resolve co-owner membership first so getRowKey() points at the shared
      // row before we compare identities (a co-owner adopts the primary's row).
      await resolveMembership();

      const newKey = getRowKey();
      const prevOwner = getDataOwner();
      if (prevOwner === newKey) return; // same identity — nothing to do

      let remote: Partial<Database> | null = null;
      try {
        remote = await syncFromSupabase();
      } catch {
        // Offline / lookup failed — leave data as-is. The sync guard prevents
        // it from being pushed to the new identity's row until we reconcile.
        return;
      }

      if (remote) {
        // This { ...defaultDatabase(), ...remote }
        setDataOwner(newKey);
        replace(migrateDatabase({ ...defaultDatabase(), ...remote }));
        return;
      }

      // No cloud data for the new identity yet.
      const migrating =
        !!prevOwner && prevOwner.startsWith("device_") && newKey.startsWith("user_");
      setDataOwner(newKey);
      if (migrating) {
        // Anonymous device data adopted by a first account — keep and claim it.
        replace(ref.current);
      } else {
        // Switching between accounts (or signing out) — start clean so we never
        // carry a different identity's data into this one.
        replace(defaultDatabase());
      }
    };

    const onAuth = (): void => void reconcile();
    window.addEventListener("pawpal:auth", onAuth);
    // Also resolve on mount: an already-signed-in co-owner on a fresh device
    // gets no auth event, but still needs to adopt the shared row.
    void reconcile();
    return () => window.removeEventListener("pawpal:auth", onAuth);
  }, [replace]);

  const value = useMemo<DbContextValue>(
    () => ({ db, update, replace, getDb }),
    [db, update, replace, getDb],
  );

  return <DbContext.Provider value={value}>{children}</DbContext.Provider>;
}

export function useDb(): DbContextValue {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error("useDb must be used within a DbProvider");
  return ctx;
}
