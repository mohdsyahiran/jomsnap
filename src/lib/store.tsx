"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { applyAction, fetchSnapshot } from "@/app/data-actions";
import type { Snapshot } from "./db";
import type { Action } from "./reducer";
import type { AdminData, Team } from "./types";

export type SaveStatus = { state: "saved" | "saving" } | { state: "error"; message: string };

type Store = {
  data: AdminData;
  savedAt: string;
  status: SaveStatus;
  user: string;
  /** Set for team logins: the data is already limited to this team, and only its stock and unavailability can change */
  team?: Team;
  /** Sends the change to the server; the screen updates once Neon has it. */
  dispatch: (a: Action) => Promise<boolean>;
};

const StoreContext = createContext<Store | null>(null);

const REFRESH_MS = 30_000;

export function StoreProvider({ user, team, initial, children }: { user: string; team?: Team; initial: Snapshot; children: React.ReactNode }) {
  const [snap, setSnap] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>({ state: "saved" });
  const versionRef = useRef(initial.version);
  const pending = useRef(0);
  // Changes go to the server one at a time, in the order they were made
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  // Signed out or signed in as someone else (e.g. in another tab): reload, so this page never shows another account's data
  const reload = useCallback(() => window.location.replace("/admin"), []);

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
          const res = await applyAction(a, user);
          if (!res.ok && res.signedOut) {
            reload();
            return false;
          }
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
    [accept, reload, user],
  );

  // Pick up changes made by others: on returning to the tab and every 30s
  useEffect(() => {
    const refresh = async () => {
      if (pending.current > 0 || document.visibilityState !== "visible") return;
      try {
        const s = await fetchSnapshot(user);
        if (s) accept(s);
        else reload();
      } catch {}
    };
    // Back/forward can restore this page from the browser's memory after signing out; load it fresh instead
    const onShow = (e: PageTransitionEvent) => e.persisted && window.location.reload();
    const t = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", onShow);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", onShow);
    };
  }, [accept, reload, user]);

  const value = useMemo(() => ({ data: snap.data, savedAt: snap.updatedAt, status, user, team, dispatch }), [snap, status, user, team, dispatch]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
