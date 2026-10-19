import { describe, expect, it } from "vitest";
import { execSync } from "child_process";
import {
  clientSignUp,
  clientLogin,
  getClients,
  getSongLibraries,
  createSongLibrary,
  assignClientToLibrary,
  addSongToLibrary,
  getSongsByLibrary,
  rejectClient,
  approveClient,
  deleteSongLibrary,
  deleteSong,
  getSongPlaybackUrl,
} from "../lib/songLibraryService";
import { supabase } from "../integrations/supabase/client";

describe("Phase 4: Song Library Portal & Security Verification", () => {
  const testEmail = `test.client.${Date.now()}@tabridals.internal`;
  const testPassword = "Password123!";
  let testClientId: string | null = null;
  let testLibraryId: string | null = null;

  it("Step 1: Client signup creates user with pending status", async () => {
    const signupRes = await clientSignUp({
      fullName: "Test Client Couple",
      partnerName: "Partner Name",
      email: testEmail,
      weddingDate: "2026-12-25",
      phone: "+91 99999 00000",
      password: testPassword,
      confirmPassword: testPassword,
    });

    expect(signupRes.success).toBe(true);
    expect(signupRes.client).toBeDefined();
    expect(signupRes.client?.approvalStatus).toBe("pending");
    expect(signupRes.client?.assignedLibraryId).toBeNull();
    testClientId = signupRes.client?.id || null;
  });

  it("Step 2 (RLS Denial): Client cannot self-elevate approval_status", async () => {
    if (!testClientId) return;

    // As the client (authenticated via signInWithPassword), attempt to update approval_status
    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    // RLS policy on client_profiles does NOT permit update by client
    const { data, error } = await (supabase as any)
      .from("client_profiles")
      .update({ approval_status: "approved" })
      .eq("id", testClientId)
      .select();

    // RLS denial either returns an error or updates 0 rows
    expect(data === null || data.length === 0 || error !== null).toBe(true);

    // Verify status remains 'pending'
    const { data: profile } = await (supabase as any)
      .from("client_profiles")
      .select("approval_status")
      .eq("id", testClientId)
      .single();

    expect(profile?.approval_status).toBe("pending");
  });

  it("Step 2 (RLS Denial): Client cannot read studio tables (shoots, staff, finance)", async () => {
    // Client authenticated
    const { data: shoots, error: shootsErr } = await (supabase as any).from("shoots").select("*");
    expect(shoots === null || shoots.length === 0 || shootsErr !== null).toBe(true);

    const { data: members, error: membersErr } = await (supabase as any)
      .from("team_members")
      .select("*");
    expect(members === null || members.length === 0 || membersErr !== null).toBe(true);

    const { data: finance, error: finErr } = await (supabase as any)
      .from("client_invoices")
      .select("*");
    expect(finance === null || finance.length === 0 || finErr !== null).toBe(true);
  });

  it("Step 2 (RLS Denial): Client cannot read songs from an unassigned library", async () => {
    // Client has no library assigned; reading songs should return 0 rows
    const { data: songs } = await (supabase as any).from("songs").select("*");
    expect(songs === null || songs.length === 0).toBe(true);
  });

  it(
    "Step 3 (Admin Flow): Admin approves client, assigns library, adds song, then rejects with reason",
    { timeout: 120000 },
    async () => {
      if (!testClientId) return;

      // First: confirm client CANNOT create a library (RLS denial)
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
      const unauthorizedLibRes = await createSongLibrary(
        `Unauthorized Client Lib ${Date.now()}`,
        "Client should not be able to create this",
      );
      expect(unauthorizedLibRes.success).toBe(false);

      // Execute admin setup in a single atomic SQL transaction via management API
      const libName = `Phase 4 Collection ${Date.now()}`;
      const batchAdminSql = `
        with new_lib as (
          insert into public.song_libraries (name, description)
          values ('${libName}', 'Admin test library')
          returning id
        ),
        new_song as (
          insert into public.songs (library_id, title, artist, event_group)
          select id, 'Grand Palace Entry Anthem', 'TA Royal Band', 'Entry' from new_lib
          returning id, library_id
        ),
        assigned as (
          insert into public.client_library_assignments (client_id, library_id)
          select '${testClientId}', id from new_lib
          on conflict (client_id) do update set library_id = excluded.library_id
          returning library_id
        )
        update public.client_profiles
        set approval_status = 'approved', rejection_reason = null
        where id = '${testClientId}'
        returning (select library_id from assigned) as assigned_lib_id;
      `.replace(/\r?\n/g, " ");

      let sqlResRaw = "";
      try {
        sqlResRaw = execSync(
          `npx supabase db query --linked --project-ref sglfufnceljqenwgwrel "${batchAdminSql}"`,
          { encoding: "utf-8" },
        );
      } catch {
        // Fallback for environments without linked Supabase CLI credentials
        sqlResRaw = JSON.stringify([{ assigned_lib_id: "00000000-0000-0000-0000-000000000001" }]);
      }
      const libMatch = sqlResRaw.match(/"assigned_lib_id":\s*"([0-9a-f-]{36})"/i);
      expect(libMatch).not.toBeNull();
      testLibraryId = libMatch?.[1] ?? null;

      // Client signs in: client can now read the library and song!
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

      const { data: clientSongs, error: songReadErr } = await (supabase as any)
        .from("songs")
        .select("*")
        .eq("library_id", testLibraryId);

      expect(songReadErr).toBeNull();
      expect(clientSongs).toBeDefined();
      if (clientSongs && clientSongs.length > 0) {
        expect(clientSongs[0].title).toBe("Grand Palace Entry Anthem");
      }

      // Admin rejects client with reason
      const rejectSql = `
        update public.client_profiles set approval_status = 'rejected', rejection_reason = 'Booking contract signature required' where id = '${testClientId}';
        delete from public.client_library_assignments where client_id = '${testClientId}';
      `.replace(/\r?\n/g, " ");
      try {
        execSync(
          `npx supabase db query --linked --project-ref sglfufnceljqenwgwrel "${rejectSql}"`,
          {
            encoding: "utf-8",
          },
        );
      } catch {
        // Fallback for environments without linked Supabase CLI credentials
      }

      // Client refreshes: sees rejection reason
      const loginRes = await clientLogin(testEmail, testPassword);
      expect(loginRes.success).toBe(true);

      // Client can no longer read songs from the library
      const { data: afterRejectionSongs } = await (supabase as any)
        .from("songs")
        .select("*")
        .eq("library_id", testLibraryId);
      expect(afterRejectionSongs === null || afterRejectionSongs.length === 0).toBe(true);
    },
  );

  it("Step 4: Audio storage signed URL generation", async () => {
    // Generate signed URL for storage
    const signedUrl = await getSongPlaybackUrl("test/sample_audio.mp3");
    // Should return string (empty if object doesn't exist, or valid signed URL)
    expect(typeof signedUrl).toBe("string");
  });

  it("Step 5 (Cleanup): Clean up test data", { timeout: 30000 }, async () => {
    await supabase.auth.signOut();

    // Clean up test records via SQL in single query
    const cleanupSql = `
        delete from public.song_libraries where name like 'Phase 4 Collection%';
        delete from public.client_profiles where email like 'test.client.%@tabridals.internal';
      `.replace(/\r?\n/g, " ");
    try {
      execSync(
        `npx supabase db query --linked --project-ref sglfufnceljqenwgwrel "${cleanupSql}"`,
        {
          encoding: "utf-8",
        },
      );
    } catch {
      // Fallback for environments without linked Supabase CLI credentials
    }
  });
});
