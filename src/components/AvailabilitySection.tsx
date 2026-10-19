import { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  LoaderCircle,
  Plus,
  Send,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type AvailabilityRequest = Tables<"availability_requests">;
export type AvailabilityRequestInput = TablesInsert<"availability_requests">;

interface AvailabilitySectionProps {
  isAdmin: boolean;
  requests: AvailabilityRequest[];
  currentUserId?: string | undefined;
  currentUserName?: string | undefined;
  onRequestSubmit: (input: AvailabilityRequestInput) => Promise<void>;
  onRequestReview?:
    ((requestId: string, status: "approved" | "rejected") => Promise<void>) | undefined;
  loading?: boolean | undefined;
}

export function AvailabilitySection({
  isAdmin,
  requests,
  currentUserId,
  currentUserName,
  onRequestSubmit,
  onRequestReview,
  loading = false,
}: AvailabilitySectionProps) {
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filteredRequests = requests.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    const form = new FormData(event.currentTarget);
    const requestType = String(form.get("request_type") ?? "unavailable") as
      "available" | "unavailable" | "leave";
    const startDate = String(form.get("start_date") ?? "");
    const endDate = String(form.get("end_date") ?? "") || startDate;
    const startTime = String(form.get("start_time") ?? "") || null;
    const endTime = String(form.get("end_time") ?? "") || null;
    const reason = String(form.get("reason") ?? "").trim() || null;

    if (!startDate) {
      setError("Please select a start date.");
      setSubmitting(false);
      return;
    }

    try {
      await onRequestSubmit({
        user_id: currentUserId || "unknown-user",
        worker_name: currentUserName || "Team Member",
        request_type: requestType,
        start_date: startDate,
        end_date: endDate,
        start_time: startTime,
        end_time: endTime,
        reason,
        status: "pending",
      });
      setSuccess("Availability request submitted successfully!");
      setShowSubmitModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#30282e] bg-[#151317] p-5">
        <div>
          <h2 className="font-serif text-2xl text-[#f7f0ee]">Availability & Leave Management</h2>
          <p className="mt-1 text-xs text-[#82767d]">
            {isAdmin
              ? "Review worker availability submissions and approve leave requests (Asia/Kolkata timezone)."
              : "Submit your upcoming available dates, unavailable time windows, or leave requests."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowSubmitModal(true)}
            className="gap-2 bg-[#c56c7d] text-xs font-medium text-[#0b0a0c] hover:bg-[#e7a0ad]"
          >
            <Plus className="size-4" />
            Submit Request
          </Button>
        </div>
      </div>

      {success && (
        <div
          className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300"
          role="status"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4" />
            <span>{success}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccess("")}
            className="underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#30282e] pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "all"
                ? "bg-[#762d40] text-[#f7f0ee]"
                : "text-[#82767d] hover:text-[#f7f0ee]"
            }`}
          >
            All Requests ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "pending"
                ? "bg-[#762d40] text-[#f7f0ee]"
                : "text-[#82767d] hover:text-[#f7f0ee]"
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("approved")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "approved"
                ? "bg-[#762d40] text-[#f7f0ee]"
                : "text-[#82767d] hover:text-[#f7f0ee]"
            }`}
          >
            Approved
          </button>
          <button
            type="button"
            onClick={() => setFilter("rejected")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "rejected"
                ? "bg-[#762d40] text-[#f7f0ee]"
                : "text-[#82767d] hover:text-[#f7f0ee]"
            }`}
          >
            Rejected
          </button>
        </div>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="rounded-2xl border border-[#30282e] bg-[#151317] p-12 text-center text-xs text-[#82767d]">
          <Calendar className="mx-auto mb-3 size-8 text-[#584e56]" />
          <p className="text-sm font-medium text-[#f7f0ee]">No availability requests found</p>
          <p className="mt-1">
            {filter === "pending"
              ? "No pending requests awaiting approval."
              : "When workers submit availability or leave, they appear here."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRequests.map((req) => {
            const isPending = req.status === "pending";
            return (
              <div
                key={req.id}
                className="flex flex-col justify-between rounded-xl border border-[#30282e] bg-[#151317] p-4 text-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[#f7f0ee]">{req.worker_name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                        req.status === "approved"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : req.status === "rejected"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-[#b8adb2]">
                    <span className="capitalize font-semibold text-[#e7a0ad]">
                      {req.request_type}
                    </span>
                    <span>·</span>
                    <span>
                      {req.start_date === req.end_date
                        ? format(parseISO(req.start_date), "MMM d, yyyy")
                        : `${format(parseISO(req.start_date), "MMM d")} – ${format(parseISO(req.end_date), "MMM d, yyyy")}`}
                    </span>
                  </div>

                  {(req.start_time || req.end_time) && (
                    <p className="mt-1 text-[11px] text-[#82767d]">
                      Time: {req.start_time || "Start"} to {req.end_time || "End"}
                    </p>
                  )}

                  {req.reason && (
                    <p className="mt-2 text-[#b8adb2] italic bg-[#1b181d] p-2 rounded-md">
                      "{req.reason}"
                    </p>
                  )}

                  <p className="mt-3 text-[10px] text-[#82767d]">
                    Submitted {format(parseISO(req.created_at), "MMM d, yyyy · h:mm a")}
                  </p>
                </div>

                {isAdmin && isPending && onRequestReview && (
                  <div className="mt-4 flex gap-2 border-t border-[#30282e] pt-3">
                    <Button
                      size="sm"
                      onClick={() => onRequestReview(req.id, "approved")}
                      className="flex-1 bg-emerald-600/80 text-white hover:bg-emerald-600 text-xs h-7"
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRequestReview(req.id, "rejected")}
                      className="flex-1 border-[#40323a] text-red-400 hover:bg-red-500/10 text-xs h-7"
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Request Modal */}
      {showSubmitModal && (
        <div
          className="studio-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowSubmitModal(false);
          }}
        >
          <section
            className="studio-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="availability-modal-title"
          >
            <div className="mb-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#e7a0ad]">
                AVAILABILITY & LEAVE
              </p>
              <h2 id="availability-modal-title" className="mt-1 font-serif text-2xl text-[#f7f0ee]">
                Submit Availability Request
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="studio-field">
                Request Type
                <select name="request_type" defaultValue="unavailable">
                  <option value="unavailable">Explicitly Unavailable</option>
                  <option value="available">Explicitly Available</option>
                  <option value="leave">Leave Request</option>
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="studio-field">
                  Start Date
                  <Input name="start_date" type="date" required />
                </label>
                <label className="studio-field">
                  End Date
                  <Input name="end_date" type="date" required />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="studio-field">
                  Start Time <span className="font-normal text-[#82767d]">· optional</span>
                  <Input name="start_time" type="time" />
                </label>
                <label className="studio-field">
                  End Time <span className="font-normal text-[#82767d]">· optional</span>
                  <Input name="end_time" type="time" />
                </label>
              </div>

              <label className="studio-field">
                Reason or Notes <span className="font-normal text-[#82767d]">· optional</span>
                <textarea
                  name="reason"
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. Out of station for personal commitment"
                  className="rounded-md border border-[#30282e] bg-[#1d171d] p-2 text-xs text-[#f7f0ee]"
                />
              </label>

              {error && (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-[#30282e] pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSubmitModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#c56c7d] text-[#0b0a0c] hover:bg-[#e7a0ad]"
                >
                  {submitting ? "Submitting…" : "Submit Request"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
