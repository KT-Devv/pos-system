/**
 * Invite someone to a shop and email them the invitation.
 *
 * The browser cannot send email (that needs the project's service-role key, which must never reach a browser),
 * so this runs on Supabase as an Edge Function. It does two things, in this order:
 *
 *   1. Saves the invitation by calling the database function `invite_member` AS THE CALLER, with their own
 *      sign-in token. The database decides whether they may (owners invite admins and cashiers, admins invite
 *      cashiers, nobody else invites) and checks the address, so this function adds no permission logic of its
 *      own and cannot be used to invite someone the caller could not invite.
 *   2. Only once that has succeeded, asks Supabase Auth to email the same address an invitation link.
 *
 * The logic lives here, free of Deno and Supabase imports, so it can be tested with plain Node
 * (handler.test.ts). index.ts connects it to the real thing.
 */

export interface InviteDeps {
  /** Saves the invitation as the person who is signed in. Resolves to an error message if the database refused. */
  saveInvitation(args: { shopId: string; email: string; role: string }): Promise<{ error: string | null }>;
  /** Emails the address a sign-up link, using the service role. */
  emailInvitation(args: { email: string; redirectTo?: string }): Promise<{ error: { message: string; code?: string } | null }>;
}

export interface InviteResult {
  status: number;
  body: { invited: true; emailed: boolean; reason?: "existing-account" | "email-failed"; detail?: string } | { error: string };
}

const ADDRESS = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function handleInvite(input: unknown, signedIn: boolean, deps: InviteDeps): Promise<InviteResult> {
  if (!signedIn) return { status: 401, body: { error: "Sign in to invite people." } };
  if (typeof input !== "object" || input === null) return { status: 400, body: { error: "Send the shop, email address and role." } };

  const { shopId, email, role, redirectTo } = input as Record<string, unknown>;
  if (typeof shopId !== "string" || typeof email !== "string" || typeof role !== "string") {
    return { status: 400, body: { error: "Send the shop, email address and role." } };
  }
  const address = email.trim().toLowerCase();
  if (!ADDRESS.test(address)) return { status: 400, body: { error: "Enter a valid email address." } };

  const saved = await deps.saveInvitation({ shopId, email: address, role });
  if (saved.error) return { status: 400, body: { error: saved.error } };

  // The invitation is saved. Emailing is best effort: if it cannot be done the invitation still stands and the
  // person who sent it can pass the message on themselves.
  const sent = await deps.emailInvitation({
    email: address,
    redirectTo: typeof redirectTo === "string" && /^https?:\/\//i.test(redirectTo) ? redirectTo : undefined,
  });
  if (!sent.error) return { status: 200, body: { invited: true, emailed: true } };

  // Someone who already has an account cannot be sent a sign-up link: they just sign in and the invitation is waiting.
  if (sent.error.code === "email_exists" || sent.error.code === "user_already_exists" || /already (been )?registered|already exists/i.test(sent.error.message)) {
    return { status: 200, body: { invited: true, emailed: false, reason: "existing-account" } };
  }
  return { status: 200, body: { invited: true, emailed: false, reason: "email-failed", detail: sent.error.message } };
}
