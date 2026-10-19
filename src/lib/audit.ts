import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, Json } from "@/integrations/supabase/types";

export type AuditLog = Tables<"audit_logs">;
export type AuditLogInsert = TablesInsert<"audit_logs">;
export type Notification = Tables<"notifications">;
export type NotificationInsert = TablesInsert<"notifications">;
export type AvailabilityRequest = Tables<"availability_requests">;
export type AvailabilityRequestInsert = TablesInsert<"availability_requests">;

export interface LogAuditParams {
  actorId?: string | null | undefined;
  actorName: string;
  actorEmail?: string | null | undefined;
  action: string;
  recordType: string;
  recordId?: string | null | undefined;
  details?: Record<string, unknown> | null | undefined;
}

/**
 * Records an administrative or security-sensitive action into the audit trail.
 */
export async function recordAuditLog(params: LogAuditParams): Promise<void> {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      actor_id: params.actorId ?? null,
      actor_name: params.actorName,
      actor_email: params.actorEmail ?? null,
      action: params.action,
      record_type: params.recordType,
      record_id: params.recordId ?? null,
      details: (params.details ?? {}) as Json,
    });
    if (error) {
      console.warn(
        "[Audit] Remote audit log not recorded (table may need migration):",
        error.message,
      );
    }
  } catch (err) {
    console.warn("[Audit] Failed to log action:", err);
  }
}

/**
 * Deletes a single audit log entry by ID.
 */
export async function deleteAuditLog(id: string): Promise<void> {
  const { error } = await supabase.from("audit_logs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Clears ALL audit log entries (admin only).
 */
export async function clearAllAuditLogs(): Promise<void> {
  const { error } = await supabase.from("audit_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(error.message);
}

/**
 * Creates an in-app notification for a user.
 */
export async function sendNotification(
  recipientId: string,
  title: string,
  message: string,
  type: "info" | "assignment" | "approval" | "system" = "info",
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { error } = await supabase.from("notifications").insert({
      recipient_id: recipientId,
      title,
      message,
      type,
      metadata: metadata as Json,
    });
    if (error) {
      console.warn("[Notification] Could not insert notification:", error.message);
    }
  } catch (err) {
    console.warn("[Notification] Error creating notification:", err);
  }
}
