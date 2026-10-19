import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, Json } from "@/integrations/supabase/types";

export type Notification = Tables<"notifications">;
export type NotificationInsert = TablesInsert<"notifications">;
export type AvailabilityRequest = Tables<"availability_requests">;
export type AvailabilityRequestInsert = TablesInsert<"availability_requests">;

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
