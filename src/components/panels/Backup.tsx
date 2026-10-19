"use client";

import { useEffect, useRef, useState } from "react";
import { STORAGE_KEY } from "@/lib/constants";
import { download } from "@/lib/download";
import { toISODate } from "@/lib/format";
import { emptyData } from "@/lib/seed";
import { isAdminData, normalize } from "@/lib/reducer";
import { useStore } from "@/lib/store";
import type { AdminData } from "@/lib/types";
import { Button, Card, Field, Icon, inputClass, Modal, PanelHeader } from "../ui";

export function Backup() {
  const { data, dispatch } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [clearing, setClearing] = useState(false);
  // Anything entered during the browser-only preview, offered for upload once
  const [local, setLocal] = useState<AdminData | null>(null);
  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
      if (isAdminData(parsed) && (parsed.bookings.length || parsed.transactions?.length)) setLocal(normalize(parsed));
    } catch {}
  }, []);

  const uploadLocal = async () => {
    if (!local || !confirm(`Replace the data in the database with what was saved in this browser (${local.bookings.length} bookings, ${local.transactions.length} money entries)?`)) return;
    if (await dispatch({ type: "load", data: local })) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      setLocal(null);
      setStatus({ ok: true, msg: "Browser data uploaded to the database." });
    }
  };

  const exportJson = () => download(JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2), `jomsnap-backup-${toISODate(new Date())}.json`, "application/json");

  const importFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!isAdminData(parsed)) throw new Error("not a JomSnap admin backup");
      if (!confirm(`Replace current data with "${file.name}" (${parsed.bookings.length} bookings)?`)) return;
      if (await dispatch({ type: "load", data: normalize(parsed) })) setStatus({ ok: true, msg: `Restored ${parsed.bookings.length} bookings from ${file.name}.` });
    } catch (e) {
      setStatus({ ok: false, msg: `Could not import ${file.name}: ${(e as Error).message}` });
    }
  };

  return (
    <div className="space-y-5">
      <PanelHeader icon="cloud_sync" iconClass="bg-tertiary-fixed text-on-tertiary-fixed" title="Backup & Data" subtitle="Everything is saved in the Neon database. Download a backup file now and then for safekeeping." />

      {local && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-secondary-fixed/60 border border-secondary-container">
          <Icon name="upload" className="text-xl text-secondary" />
          <p className="flex-1 text-body-sm">
            This browser still has data from the preview ({local.bookings.length} bookings, {local.transactions.length} money entries) that isn&apos;t in the database.
          </p>
          <Button variant="primary" icon="cloud_upload" onClick={uploadLocal}>
            Upload to database
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-6 flex flex-col gap-4">
          <h3 className="text-headline-sm font-bold text-primary flex items-center gap-2">
            <Icon name="download" className="text-secondary" />
            Export backup
          </h3>
          <p className="text-body-sm text-on-surface-variant">
            {data.bookings.length} bookings, {data.transactions.length} money entries, {data.stock.length} stock items and {data.audit.length} log entries. Keep a copy in Google Drive regularly.
          </p>
          <Button variant="primary" icon="file_download" onClick={exportJson} className="self-start">
            Download JSON backup
          </Button>
        </Card>

        <Card className="p-6 flex flex-col gap-4">
          <h3 className="text-headline-sm font-bold text-primary flex items-center gap-2">
            <Icon name="upload" className="text-secondary" />
            Restore backup
          </h3>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) importFile(f);
            }}
            className={`border-2 border-dashed rounded-xl p-6 text-center text-body-sm transition-colors ${
              dragging ? "border-secondary bg-secondary-fixed/40" : "border-outline-variant hover:bg-surface-container-low"
            }`}
          >
            <Icon name="upload_file" className="text-3xl text-outline" />
            <p className="mt-1">Drop a .json backup here, or click to choose</p>
          </button>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = "";
            }}
          />
          {status && <p className={`text-body-sm ${status.ok ? "text-tertiary" : "text-error"}`}>{status.msg}</p>}
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-headline-sm font-bold text-primary flex items-center gap-2 mb-2">
          <Icon name="restart_alt" className="text-secondary" />
          Reset
        </h3>
        <p className="text-body-sm text-on-surface-variant mb-4">Remove everything from the database and start fresh. Download a backup first if you might need it.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" icon="delete_sweep" onClick={() => setClearing(true)}>
            Clear all data
          </Button>
        </div>
      </Card>

      <Modal open={clearing} onClose={() => setClearing(false)} title="Clear all data?">
        {clearing && <ClearForm onDone={() => setClearing(false)} />}
      </Modal>
    </div>
  );
}

/** Clearing can't be undone, so the button only unlocks once "delete" is typed */
function ClearForm({ onDone }: { onDone: () => void }) {
  const { data, dispatch } = useStore();
  const [typed, setTyped] = useState("");
  const ok = typed.trim().toLowerCase() === "delete";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    if (await dispatch({ type: "load", data: emptyData() })) onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-body-sm text-on-surface-variant">
        This deletes <strong className="text-on-surface">all {data.bookings.length} bookings</strong>, their payments, {data.transactions.length} money entries, stock counts,
        unavailable days and the activity log from the database, for everyone. It can&apos;t be undone.
      </p>
      <Field label='Type "delete" to confirm'>
        <input className={inputClass} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="delete" autoComplete="off" autoFocus />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="danger" type="submit" icon="delete_sweep" disabled={!ok}>
          Clear all data
        </Button>
      </div>
    </form>
  );
}
