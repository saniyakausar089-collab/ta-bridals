import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type AuditLog = Tables<"audit_logs">;
export type AuditLogInsert = TablesInsert<"audit_logs">;
export type Notification = Tables<"notifications">;
export type NotificationInsert = TablesInsert<"notifications">;
export type AvailabilityRequest = Tables<"availability_requests">;
export type AvailabilityRequestInsert = TablesInsert<"availability_requests">;

export interface LogAuditParams {
  actorId?: string | null;
  actorName: string;
  actorEmail?: string | null;
  action: string;
  recordType: string;
  recordId?: string | null;
  details?: Record<string, unknown>;
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
      details: params.details ?? {},
    });
    if (error) {
      console.warn("[Audit] Remote audit log not recorded (table may need migration):", error.message);
    }
  } catch (err) {
    console.warn("[Audit] Failed to log action:", err);
  }
}

/**
 * Creates an in-app notification for a user.
 */
export async function sendNotification(
  recipientId: string,
  title: string,
  message: string,
  type: "info" | "assignment" | "approval" | "system" = "info",
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { error } = await supabase.from("notifications").insert({
      recipient_id: recipientId,
      title,
      message,
      type,
      metadata,
    });
    if (error) {
      console.warn("[Notification] Could not insert notification:", error.message);
    }
  } catch (err) {
    console.warn("[Notification] Error creating notification:", err);
  }
}
