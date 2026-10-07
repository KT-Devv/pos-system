import { normalizeInviteCode } from "@pos/shared";
import type { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Client = ReturnType<typeof createSupabaseBrowserClient>;

export type JoinResult = { ok: true } | { ok: false; message: string };

/**
 * Joins the signed-in person to the shop an invitation code belongs to. The database does the checking: the same
 * answer comes back for a mistyped code, an expired one and one already used, and repeated wrong guesses are slowed down.
 */
export async function redeemInviteCode(supabase: Client, text: string): Promise<JoinResult> {
  const code = normalizeInviteCode(text);
  if (!code) return { ok: false, message: "Enter your invitation code." };
  const { data, error } = await supabase.rpc("redeem_invite", { p_code: code });
  if (error) {
    if (/already belong to a shop/i.test(error.message)) return { ok: false, message: "This account already belongs to a shop, and an account can only work in one." };
    return { ok: false, message: error.message };
  }
  const result = data as { shop_id?: string; error?: string } | null;
  if (result?.shop_id) return { ok: true };
  if (result?.error === "too_many_attempts") return { ok: false, message: "Too many wrong codes. Wait about an hour and try again, or ask for a new code." };
  return { ok: false, message: "That invitation code isn't valid. Check it was typed correctly, or ask for a new one: a code works once and expires after a day." };
}
