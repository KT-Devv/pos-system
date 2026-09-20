# Shops, teams and data isolation

KTDEVV POS is multi-tenant: many independent businesses ("shops") share one
Supabase project and one application, and none of them can see or change
another's data. This page explains how that works and what to do when adding
features.

## What a customer experiences

1. They sign up (or sign in) with email and password.
2. If they have no shop yet, the workspace shows **first-login setup**:
   - If someone has invited their email address, they can **join** that shop.
   - Otherwise they **create a shop**: name, country, currency, optional phone,
     email and address, then a low-stock warning level and loyalty rules.
3. They land on their shop's overview. Everything in the app (prices, reports,
   inputs, charts) now uses the shop's currency.
4. Owners and admins open **Settings** to edit the shop and manage the team.

The same flow runs in the browser and the desktop app; the desktop app is the
same exported web application.

## Data model

| Table | Purpose |
| --- | --- |
| `shops` | One row per business: name, currency, country, contact details, `low_stock_threshold`, `loyalty_enabled`, `loyalty_spend_per_point`, `owner_id` |
| `shop_members` | Who works in which shop and as what (`owner`, `admin`, `cashier`) |
| `shop_invites` | Pending invitations by email (14 days) |
| `profiles` | One row per account: name and email |
| everything else | `categories`, `products`, `customers`, `suppliers`, `sales`, `sale_lines`, `stock_movements` all carry a `shop_id` |

An account belongs to **one** shop for now (`unique (user_id)` on
`shop_members`). Removing that constraint is the first step toward letting one
person work in several shops; the client would also need a shop switcher.

## How isolation is enforced

Isolation is enforced in the database, not in the UI, in three layers:

1. **Row-level security.** Every table has policies built on
   `is_shop_member(shop_id)` and `is_shop_admin(shop_id)`. A query only ever
   sees rows from the caller's shop, whatever the client asks for.
2. **Shop-scoped foreign keys.** Cross-table references are composite, for
   example `products (category_id, shop_id) -> categories (id, shop_id)`, so a
   row cannot point at another shop's data even if someone knows its id.
   `shop_id` also cannot be changed after insert.
3. **RPCs check membership themselves.** `create_sale`, `record_stock_movement`
   and the team functions run with definer rights, so each one verifies the
   caller belongs to the shop, and that every product, customer, supplier and
   cashier involved belongs to it too.

## Roles

| | Owner | Admin | Cashier |
| --- | :-: | :-: | :-: |
| Sell, record stock, add customers and suppliers | yes | yes | yes |
| Add, edit and delete products and categories | yes | yes | no |
| Edit shop settings (name, low-stock level, loyalty, ...) | yes | yes | no |
| Invite and remove cashiers | yes | yes | no |
| Invite and remove admins, change roles | yes | no | no |
| Rewrite or delete sales history directly through the API | yes | yes | no |

The owner is the shop's creator, is unique, and cannot be removed or demoted.
Role changes and removals go through RPCs (`set_member_role`, `remove_member`)
which enforce these rules; `shop_members` has no direct write policies.

The currency cannot be changed after the shop has recorded a sale, because every
historic amount would silently change meaning. Only the SQL editor bypasses this.

## Invitations

There is no outbound email yet. An owner or admin enters a colleague's address in
**Settings > Team**; the colleague signs up or signs in with **that exact
address** (case-insensitive) and is offered the invitation on first login. To send
real email later, add a Supabase Edge Function that calls
`auth.admin.inviteUserByEmail` after `invite_member`.

## Adding a feature

- **New table:** add `shop_id uuid not null references shops(id) on delete
  cascade`, a `unique (id, shop_id)` if other tables reference it, composite
  foreign keys to other shop-scoped tables, an index on `shop_id`, RLS policies
  using the helper functions, and the `prevent_shop_change` trigger.
- **New query:** set `shop_id` on insert (`useWorkspace().shop.id`); reads are
  already scoped by RLS.
- **New RPC:** if it uses definer rights, check `auth.uid()` and
  `is_shop_member(...)`, revoke execute from `public, anon`, and grant it to
  `authenticated`.
- **Money and settings:** never hardcode a currency or threshold. Use
  `useWorkspace()` and `formatCurrency`.
- **Offline data:** anything queued locally must record its `shop_id` and only be
  synchronized to that shop.

## Verifying isolation

```powershell
npm run test:db
```

This loads `schema.v2.sql` (and the upgrade migration) into an in-memory
Postgres that imitates Supabase's roles and JWT claims, then checks, for a fresh
install and for an upgraded single-shop database: a user in shop B cannot read,
insert into, update or delete shop A's rows; foreign keys reject cross-shop
references; each RPC refuses another shop's ids; cashiers cannot change the
catalog or promote themselves; invitations only work for their addressee; and
anonymous callers cannot execute any function. Run it after every change to the
schema, and extend `database/tests/tenancy.mjs` when you add a table or RPC.
