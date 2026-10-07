// Supabase Edge Function: invite-member. See handler.ts for what it does and why. Deploy steps: docs/INVITATIONS.md.
//
// Leave "Verify JWT" switched on (the default) so only signed-in people can call it. SUPABASE_URL,
// SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided to every Edge Function by Supabase.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleInvite } from "./handler.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply(405, { error: "Use POST." });

  const authorization = request.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL")!;
  const asCaller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const asAdmin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let input: unknown = null;
  try {
    input = await request.json();
  } catch {
    // handleInvite answers with a clear message for a missing or unreadable body.
  }

  const { data: caller } = authorization ? await asCaller.auth.getUser() : { data: { user: null } };

  const result = await handleInvite(input, Boolean(caller.user), {
    async saveInvitation({ shopId, email, role }) {
      const { error } = await asCaller.rpc("invite_member", { p_shop_id: shopId, p_email: email, p_role: role });
      return { error: error ? error.message : null };
    },
    async emailInvitation({ email, redirectTo }) {
      const { error } = await asAdmin.auth.admin.inviteUserByEmail(email, redirectTo ? { redirectTo } : undefined);
      return { error: error ? { message: error.message, code: (error as { code?: string }).code } : null };
    },
  });
  return reply(result.status, result.body);
});
