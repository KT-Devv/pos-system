# Inviting staff

Settings > Team > **Invite someone** adds a person to a shop as a cashier or admin.

## What happens

1. The invitation is saved (`invite_member` in the database, which also decides who is allowed to invite whom).
   An invitation is **not** an account: nothing appears under Authentication > Users in Supabase until the
   invited person signs up.
2. The app then asks the `invite-member` Edge Function to **email** them. The email contains a link that
   confirms their address and lets them choose a password.
3. When they sign in with that email address, their invitation is waiting on the first screen. They press
   **Join**. (An invitation only works for the exact address it was sent to, which Supabase has verified.)

If the email can't be sent (the function isn't deployed yet, the address already has an account, or the email
service refused), the invitation is **still saved** and the app shows a ready-made message to copy, or send by
email or WhatsApp. **Pending invitations** has a share button to show that message again.

Someone who already has an account does not get an email: they just sign in with the invited address. An account
works in **one** shop only, so an address that already runs its own shop can't be invited; use another address.

## Switch on invitation emails

Without this, the app still works but you pass the message on yourself.

1. **Deploy the function** (once, and again if `supabase/functions/invite-member` changes). From the repo root:

   ```bash
   npx supabase login
   npx supabase functions deploy invite-member --project-ref YOUR-PROJECT-REF
   ```

   The project reference is the part of your Supabase URL before `.supabase.co`. Leave "Verify JWT" on (the default);
   it keeps the function to signed-in people. It needs no secrets: Supabase gives every function the keys it needs.

2. **Set up email sending.** Supabase's built-in email sender is only for trying things out: it sends to the
   addresses of your own Supabase team members and at most a couple of emails an hour, so invitations (and
   sign-up confirmations) to anyone else silently don't arrive. For real use add your own SMTP service under
   Authentication > Emails > SMTP Settings (Resend, Brevo, Mailgun, Gmail with an app password, ...).

3. **Tell Supabase your web address.** Authentication > URL Configuration: set **Site URL** to your shop's web address
   (for example `https://your-shop.onrender.com`) and add `https://your-shop.onrender.com/**` under Redirect URLs.

4. **Desktop app:** its window has no public address of its own, so set `NEXT_PUBLIC_SITE_URL=https://your-shop.onrender.com`
   in `apps/web/.env.local` before running `npm run build:tauri`. The website works the address out by itself.

Optional: Authentication > Emails > Templates > "Invite user" lets you reword the email.

## How it is built

- `supabase/functions/invite-member/handler.ts` holds the logic and is tested with `npm run test:functions`
  (plain Node, no Supabase needed). It saves the invitation **as the caller** using their own sign-in token, so
  the database's rules decide who may invite; only after that succeeds does it use the service-role key to send
  the email. The service-role key lives only on Supabase and never reaches the app.
- `apps/web/src/features/team.tsx` calls the function and falls back to saving the invitation directly (and showing
  the message to share) when the function isn't there.
- The message text is `invitationMessage` in `packages/shared`.
