import "server-only";
import { neon } from "@neondatabase/serverless";
import { normalize } from "./reducer";
import { emptyData } from "./seed";
import type { AdminData } from "./types";

/**
 * The whole admin dataset is one JSONB document (a small business has hundreds of rows, not millions).
 * `version` gives optimistic locking: a write only lands if nobody else saved in between.
 */
export type Snapshot = { data: AdminData; version: number; updatedAt: string };

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

let schemaReady: Promise<unknown> | null = null;
function ensureSchema() {
  schemaReady ??= sql()`
    CREATE TABLE IF NOT EXISTS admin_state (
      id         int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      data       jsonb NOT NULL,
      version    int NOT NULL DEFAULT 1,
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text
    )`.catch((e) => {
    schemaReady = null;
    throw e;
  });
  return schemaReady;
}

type Row = { data: AdminData; version: number; updated_at: string | Date };
const toSnapshot = (r: Row): Snapshot => ({ data: normalize(r.data), version: r.version, updatedAt: new Date(r.updated_at).toISOString() });

export async function loadSnapshot(): Promise<Snapshot> {
  await ensureSchema();
  const q = sql();
  const rows = (await q`SELECT data, version, updated_at FROM admin_state WHERE id = 1`) as Row[];
  if (rows[0]) return toSnapshot(rows[0]);
  // First run: start empty. ON CONFLICT covers two first requests racing.
  await q`INSERT INTO admin_state (id, data) VALUES (1, ${JSON.stringify(emptyData())}::jsonb) ON CONFLICT (id) DO NOTHING`;
  const again = (await q`SELECT data, version, updated_at FROM admin_state WHERE id = 1`) as Row[];
  return toSnapshot(again[0]);
}

/** Returns the new snapshot, or null if someone else saved first (caller retries on fresh data). */
export async function saveSnapshot(data: AdminData, expectedVersion: number, by: string): Promise<Snapshot | null> {
  const rows = (await sql()`
    UPDATE admin_state
       SET data = ${JSON.stringify(data)}::jsonb, version = version + 1, updated_at = now(), updated_by = ${by}
     WHERE id = 1 AND version = ${expectedVersion}
     RETURNING data, version, updated_at`) as Row[];
  return rows[0] ? toSnapshot(rows[0]) : null;
}
