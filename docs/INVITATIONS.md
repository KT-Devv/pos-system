# Inviting staff

People join a shop with an **invitation code**.

- **Someone who was invited** types the code when they sign up (there is an "Invitation code" box on the sign-up form,
  filled in for them if they use the sign-up link from the message). As soon as they sign in for the first time they
  are in that shop, with the role the code was made for.
- **Someone who was not invited** leaves the box empty, signs up, and sets up their own shop.
- **Someone who is already signed in without a shop** sees "I have an invitation code" on the shop set-up screen.

## Making a code

Settings > Team > **Invite someone**: optionally write who it is for, choose the role (owners can invite admins and
cashiers, admins can invite cashiers), and press **Create code**. The code appears big enough to read out, with a
message to copy or send by email or WhatsApp. Under **Invitation codes** each unused code can be copied, shared again or
cancelled.

A code works **once** and **expires 24 hours** after it was made. After it is used, or has expired, or has been
cancelled, it is dead: a new person needs a new code. A shop can have up to 25 unused codes at a time.

## Why it is safe

- A code is 10 letters and digits (no 0, O, 1, I or L, which look alike), about 8 x 10^14 possibilities, made by the
  database. A wrong code, an expired one and a used one all give the same answer.
- Ten wrong codes in an hour lock that account out of trying for the rest of the hour.
- Only owners and admins can see a shop's codes. Nobody can write the invitations table directly: codes are made by
  `create_invite` and used by `redeem_invite`, both checked in the database (`database/schema.v2.sql`).
- Using a code is one step in the database, so two people typing the same code at once cannot both get in.
- An account works in **one** shop. Someone who already has a shop cannot use a code.

## Details worth knowing

- A code typed at sign-up travels with the new account (in its sign-up details) and is used the first time they open
  the app, which may be after they confirm their email, possibly on another device. If it no longer works by then, they
  are shown the code screen with the reason and can correct it or set up their own shop.
- Codes do not depend on email, so nothing here needs an email service. Signing up itself may: if Supabase's
  Authentication > Providers > Email has "Confirm email" switched on, a new person must click the confirmation link first.
  Supabase's built-in email sender only reaches your own Supabase team members and only a couple of emails an hour, so
  for real use either add your own SMTP service (Authentication > Emails > SMTP Settings) or switch "Confirm email" off;
  with codes, joining a shop no longer relies on a verified address.
- `NEXT_PUBLIC_SITE_URL` (in `apps/web/.env.local`, needed for the desktop app) is the public web address put in the
  message's sign-up link. The website works its own address out.
- Upgrading from email invitations: run `database/migrations/011_invitation_codes.sql` once (after 010) before deploying
  this version. Invitations that were still waiting are deleted by it (they were tied to an email address); people who
  already joined are not affected. The `invite-member` Edge Function from the email version is no longer used and can be
  removed: `npx supabase functions delete invite-member --project-ref YOUR-PROJECT-REF`.
