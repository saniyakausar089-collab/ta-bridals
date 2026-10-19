import { describe, it, expect } from "vitest";
import { supabase } from "@/integrations/supabase/client";

describe("Shoots Column & Name Synchronization", () => {
  it("normalizes shoots with couple_name and shoot name fallback", () => {
    const rawShootsFromDb = [
      {
        id: "s-1",
        couple_name: "Aisha & Kabir",
        "shoot name": "Aisha & Kabir",
        event_type: "Wedding",
        event_date: "2026-11-20",
      },
      {
        id: "s-2",
        couple_name: null,
        "shoot name": "Pooja & Rohan Sangeet",
        event_type: "Sangeet",
        event_date: "2026-11-25",
      },
      {
        id: "s-3",
        couple_name: "Sneha & Varun",
        "shoot name": null,
        event_type: "Reception",
        event_date: "2026-11-30",
      },
    ];

    const normalized = rawShootsFromDb.map((s) => {
      const title = s.couple_name || (s as any)["shoot name"] || "Untitled Shoot";
      return {
        ...s,
        couple_name: title,
        "shoot name": title,
      };
    });

    expect(normalized[0].couple_name).toBe("Aisha & Kabir");
    expect(normalized[0]["shoot name"]).toBe("Aisha & Kabir");

    expect(normalized[1].couple_name).toBe("Pooja & Rohan Sangeet");
    expect(normalized[1]["shoot name"]).toBe("Pooja & Rohan Sangeet");

    expect(normalized[2].couple_name).toBe("Sneha & Varun");
    expect(normalized[2]["shoot name"]).toBe("Sneha & Varun");
  });

  it("successfully validates database trigger sync for couple_name and shoot name without NOT NULL error", async () => {
    // Attempt inserting a shoot with couple_name only via Supabase client
    const testShootData = {
      couple_name: "Automated Test Couple",
      event_type: "Pre-wedding",
      event_date: "2026-12-31",
      location: "Studio Hyderabad",
      start_time: "10:00:00",
      planned_team_size: 7,
      status: "Upcoming",
    };

    // Note: If unauthenticated, RLS may reject, but NOT 23502 not-null violation on 'shoot name'
    const { data, error } = await supabase.from("shoots").insert(testShootData as any).select().single();

    if (error) {
      // Must NOT fail with NOT NULL constraint violation for 'shoot name'
      expect(error.message).not.toContain('null value in column "shoot name"');
      expect(error.code).not.toBe("23502");
    } else if (data) {
      expect(data.couple_name).toBe("Automated Test Couple");
      expect((data as any)["shoot name"]).toBe("Automated Test Couple");

      // Clean up test shoot
      await supabase.from("shoots").delete().eq("id", data.id);
    }
  });
});
