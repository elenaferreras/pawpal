import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Database } from "../types";
import { loadDatabase, persistDatabase } from "./storage";

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
    persistDatabase(next);
    ref.current = next;
    setDb(next);
  }, []);

  const getDb = useCallback(() => ref.current, []);

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
