"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { applyAction, fetchSnapshot } from "@/app/data-actions";
import type { Snapshot } from "./db";
import type { Action } from "./reducer";
import type { AdminData } from "./types";

export type SaveStatus = { state: "saved" | "saving" } | { state: "error"; message: string };

type Store = {
  data: AdminData;
  savedAt: string;
  status: SaveStatus;
  user: string;
  /** Sends the change to the server; the screen updates once Neon has it. */
  dispatch: (a: Action) => Promise<boolean>;
};

const StoreContext = createContext<Store | null>(null);

const REFRESH_MS = 30_000;

export function StoreProvider({ user, initial, children }: { user: string; initial: Snapshot; children: React.ReactNode }) {
  const [snap, setSnap] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>({ state: "saved" });
  const versionRef = useRef(initial.version);
  const pending = useRef(0);
  // Changes go to the server one at a time, in the order they were made
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const accept = useCallback((s: Snapshot) => {
    if (s.version >= versionRef.current) {
      versionRef.current = s.version;
      setSnap(s);
    }
  }, []);

  const dispatch = useCallback(
    (a: Action) => {
      pending.current++;
      setStatus({ state: "saving" });
      const run = queue.current.then(async () => {
        try {
          const res = await applyAction(a);
          if (!res.ok) {
            setStatus({ state: "error", message: res.error });
            return false;
          }
          accept(res.snapshot);
          if (pending.current === 1) setStatus({ state: "saved" });
          return true;
        } catch {
          setStatus({ state: "error", message: "Could not save. Check your connection and try again." });
          return false;
        } finally {
          pending.current--;
        }
      });
      queue.current = run;
      return run;
    },
    [accept],
  );

  // Pick up changes made by others: on returning to the tab and every 30s
  useEffect(() => {
    const refresh = async () => {
      if (pending.current > 0 || document.visibilityState !== "visible") return;
      try {
        accept(await fetchSnapshot());
      } catch {}
    };
    const t = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [accept]);

  const value = useMemo(() => ({ data: snap.data, savedAt: snap.updatedAt, status, user, dispatch }), [snap, status, user, dispatch]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
