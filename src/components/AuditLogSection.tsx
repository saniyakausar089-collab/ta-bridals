import { format, parseISO } from "date-fns";
import { Activity, Shield, User, Clock, FileText } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type AuditLog = Tables<"audit_logs">;

interface AuditLogSectionProps {
  logs: AuditLog[];
  loading?: boolean;
}

export function AuditLogSection({ logs, loading = false }: AuditLogSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#30282e] bg-[#151317] p-5">
        <div>
          <h2 className="font-serif text-2xl text-[#f7f0ee]">Studio Audit Trail</h2>
          <p className="mt-1 text-xs text-[#82767d]">
            Immutable record of administrative actions, role adjustments, worker approvals, and
            shoot modifications.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#30282e] bg-[#1b181d] px-3 py-1.5 text-xs text-[#d9b98c]">
          <Shield className="size-4" />
          <span>Admin Access Only</span>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-2xl border border-[#30282e] bg-[#151317] p-12 text-center text-xs text-[#82767d]">
          <Activity className="mx-auto mb-3 size-8 text-[#584e56]" />
          <p className="text-sm font-medium text-[#f7f0ee]">No audit logs recorded yet</p>
          <p className="mt-1">
            Administrative actions will automatically generate audit logs here.
          </p>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242026]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#1b181d] transition-colors">
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
