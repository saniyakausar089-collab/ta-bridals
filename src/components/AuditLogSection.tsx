import { format, parseISO } from "date-fns";
import { Activity, Shield, RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { deleteAuditLog, clearAllAuditLogs } from "@/lib/audit";
import type { Tables } from "@/integrations/supabase/types";

type AuditLog = Tables<"audit_logs">;

interface AuditLogSectionProps {
  logs: AuditLog[];
  loading?: boolean;
  onRefresh?: () => void;
}

export function AuditLogSection({ logs, loading = false, onRefresh }: AuditLogSectionProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleDeleteRow(id: string) {
    setDeletingId(id);
    setErrorMsg(null);
    try {
      await deleteAuditLog(id);
      onRefresh?.();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to delete entry.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleClearAll() {
    setClearing(true);
    setErrorMsg(null);
    try {
      await clearAllAuditLogs();
      setConfirmClear(false);
      onRefresh?.();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to clear logs.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#30282e] bg-[#151317] p-5">
        <div>
          <h2 className="font-serif text-2xl text-[#f7f0ee]">Studio Audit Trail</h2>
          <p className="mt-1 text-xs text-[#82767d]">
            Immutable record of administrative actions, role adjustments, worker approvals, and
            shoot modifications.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Clear All button */}
          {logs.length > 0 && !confirmClear && (
            <button
              onClick={() => setConfirmClear(true)}
              disabled={clearing}
              className="flex items-center gap-1.5 rounded-lg border border-[#40232b] bg-[#1f1217] px-3 py-1.5 text-xs text-[#e7a0ad] transition-colors hover:bg-[#2c1620] hover:border-[#6b3040] disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
              <span>Clear All Logs</span>
            </button>
          )}

          {/* Confirm Clear dialog inline */}
          {confirmClear && (
            <div className="flex items-center gap-2 rounded-lg border border-[#6b3040] bg-[#1f1217] px-3 py-1.5 text-xs">
              <AlertTriangle className="size-3.5 text-[#e7a0ad]" />
              <span className="text-[#f7f0ee]">Delete all logs?</span>
              <button
                onClick={() => void handleClearAll()}
                disabled={clearing}
                className="rounded px-2 py-0.5 bg-[#6b3040] text-[#f7f0ee] hover:bg-[#8b3a50] disabled:opacity-50 transition-colors"
              >
                {clearing ? "Clearing…" : "Yes, clear"}
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="rounded px-2 py-0.5 text-[#82767d] hover:text-[#f7f0ee] transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={() => onRefresh()}
              disabled={loading}
              title="Refresh audit logs"
              className="flex items-center gap-1.5 rounded-lg border border-[#30282e] bg-[#1b181d] px-3 py-1.5 text-xs text-[#82767d] transition-colors hover:border-[#584e56] hover:text-[#f7f0ee] disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Loading…" : "Refresh"}</span>
            </button>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-[#30282e] bg-[#1b181d] px-3 py-1.5 text-xs text-[#d9b98c]">
            <Shield className="size-4" />
            <span>Admin Access Only</span>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="rounded-lg border border-[#6b3040] bg-[#1f1217] px-4 py-3 text-xs text-[#e7a0ad]">
          {errorMsg}
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="rounded-2xl border border-[#30282e] bg-[#151317] p-12 text-center">
          <RefreshCw className="mx-auto mb-3 size-8 animate-spin text-[#584e56]" />
          <p className="text-sm text-[#82767d]">Loading audit logs…</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-[#30282e] bg-[#151317] p-12 text-center text-xs text-[#82767d]">
          <Activity className="mx-auto mb-3 size-8 text-[#584e56]" />
          <p className="text-sm font-medium text-[#f7f0ee]">No audit logs recorded yet</p>
          <p className="mt-1">Administrative actions will automatically generate audit logs here.</p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[#30282e] bg-[#151317]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#30282e] text-[#82767d]">
                  <th className="py-3 px-5 font-medium">Timestamp</th>
                  <th className="py-3 px-4 font-medium">Actor</th>
                  <th className="py-3 px-4 font-medium">Action</th>
                  <th className="py-3 px-4 font-medium">Record Type</th>
                  <th className="py-3 px-5 font-medium">Details</th>
                  <th className="py-3 px-4 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242026]">
                {logs.map((log) => (
                  <tr key={log.id} className="group hover:bg-[#1b181d] transition-colors">
                    <td className="py-3.5 px-5 text-[#b8adb2] whitespace-nowrap">
                      {format(parseISO(log.created_at), "MMM d, yyyy · h:mm a")}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#f7f0ee]">
                      <div className="flex items-center gap-2">
                        <div className="grid size-6 place-items-center rounded-full bg-[#24171e] text-[10px] text-[#e7a0ad]">
                          {log.actor_name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p>{log.actor_name}</p>
                          {log.actor_email && (
                            <p className="text-[10px] text-[#82767d]">{log.actor_email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="rounded-md bg-[#24171e] border border-[#40323a] px-2 py-1 text-[11px] font-medium text-[#e7a0ad]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#d9b98c] capitalize">{log.record_type}</td>
                    <td className="py-3.5 px-5 text-[#b8adb2] max-w-xs truncate">
                      {typeof log.details === "object"
                        ? JSON.stringify(log.details)
                        : String(log.details || "—")}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => void handleDeleteRow(log.id)}
                        disabled={deletingId === log.id}
                        title="Delete this log entry"
                        aria-label={`Delete audit log entry for ${log.action}`}
                        className="rounded p-1 text-[#584e56] opacity-0 group-hover:opacity-100 transition-all hover:bg-[#2c1620] hover:text-[#e7a0ad] disabled:opacity-50"
                      >
                        {deletingId === log.id ? (
                          <RefreshCw className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
