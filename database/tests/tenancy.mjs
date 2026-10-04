import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

// usage: node tenancy.mjs <label> [--legacy legacy_seed.sql] file1.sql file2.sql ...
const args = process.argv.slice(2);
const label = args.shift();
let legacySeed = null;
const files = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--legacy") { legacySeed = args[++i]; } else files.push(args[i]);
}
const db = new PGlite();

// ---- Minimal Supabase environment (roles, JWT claims, default grants) -------------------------------
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);

const applyFile = async (file) => db.exec(fs.readFileSync(file, "utf8").replace(/create extension if not exists "pgcrypto";/g, ""));

// Legacy path: old single-shop schema first, then legacy data, then the migration.
const legacy = { ids: {} };
if (legacySeed) {
  await applyFile(files.shift());          // pre-004 schema
  await db.exec(fs.readFileSync(legacySeed, "utf8"));
}
for (const f of files) await applyFile(f);

// ---- Helpers ----------------------------------------------------------------------------------------
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const U = {
  ownerA: { id: uuid(1), email: "owner.a@shop.test", name: "Owner A" },
  adminA: { id: uuid(2), email: "admin.a@shop.test", name: "Admin A" },
  cashA: { id: uuid(3), email: "cash.a@shop.test", name: "Cashier A" },
  ownerB: { id: uuid(4), email: "owner.b@shop.test", name: "Owner B" },
  cashB: { id: uuid(5), email: "cash.b@shop.test", name: "Cashier B" },
  newbie: { id: uuid(6), email: "newbie@shop.test", name: "Newbie" },
  invitee: { id: uuid(7), email: "Invitee@Shop.Test", name: "Invitee" },
  stranger: { id: uuid(8), email: "stranger@shop.test", name: "Stranger" },
};
for (const u of Object.values(U)) {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [u.id, u.email, JSON.stringify({ display_name: u.name })]);
}

async function as(user, fn) {
  const claims = user ? JSON.stringify({ sub: user.id, email: user.email, role: "authenticated" }) : "";
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  try { return await fn(); } finally { await db.exec(`reset role`); await db.query(`select set_config('request.jwt.claims', '', false)`); }
}
const q = (sql, params) => db.query(sql, params);
const one = async (sql, params) => (await q(sql, params)).rows[0];
const results = [];
const test = async (name, fn) => {
  try { const detail = await fn(); results.push({ name, pass: true, detail }); }
  catch (e) { results.push({ name, pass: false, detail: e.message.split("\n")[0] }); }
};
const ok = (cond, msg) => { if (!cond) throw new Error(msg ?? "assertion failed"); };
const denied = async (fn, pattern, what) => {
  try { await fn(); } catch (e) { if (pattern && !pattern.test(e.message)) throw new Error(`${what ?? "failed"} but with the wrong error: ${e.message.split("\n")[0]}`); return e.message.split("\n")[0]; }
  throw new Error(`${what ?? "operation"} unexpectedly succeeded`);
};
const noRows = async (fn, what) => { const r = await fn(); ok(r.rows.length === 0 && (r.affectedRows ?? 0) === 0, `${what ?? "statement"} touched ${r.rows.length || r.affectedRows} row(s)`); };
const call = (user, sql, params) => as(user, () => q(sql, params));

// ---- Onboarding --------------------------------------------------------------------------------------
let shopA, shopB;
await test("signup creates a profile with name and email", async () => {
  const p = await one(`select name, email from public.profiles where id = $1`, [U.ownerA.id]);
  ok(p.name === "Owner A" && p.email === U.ownerA.email, JSON.stringify(p));
});
await test("a new user belongs to no shop until they create or join one", async () => {
  ok((await one(`select count(*)::int c from public.shop_members where user_id = $1`, [U.newbie.id])).c === 0);
});
await test("create_shop makes the caller the owner and stores the settings", async () => {
  const r = await call(U.ownerA, `select public.create_shop('Alpha Mart', 'ghs', 'gh', '024 000 0000', 'a@mart.test', 'Accra', 8, true, 10) as id`);
  shopA = r.rows[0].id;
  const s = await one(`select * from public.shops where id = $1`, [shopA]);
  const m = await one(`select role from public.shop_members where shop_id = $1 and user_id = $2`, [shopA, U.ownerA.id]);
  ok(s.name === "Alpha Mart" && s.currency === "GHS" && s.country === "GH" && s.low_stock_threshold === 8, JSON.stringify(s));
  ok(m.role === "owner", `role=${m.role}`);
});
await test("a second create_shop by the same person is refused", () =>
  denied(() => call(U.ownerA, `select public.create_shop('Another', 'USD')`), /already belong/));
await test("create_shop rejects a bad name, currency, or loyalty rate", async () => {
  await denied(() => call(U.newbie, `select public.create_shop('A', 'USD')`), /check|violates/, "one-letter name");
  await denied(() => call(U.newbie, `select public.create_shop('Good Name', 'DOLLAR')`), /check|violates/, "bad currency");
  await denied(() => call(U.newbie, `select public.create_shop('Good Name', 'USD', null, null, null, null, 5, true, 0)`), /check|violates/, "zero loyalty rate");
  await denied(() => call(U.newbie, `select public.create_shop('Good Name', 'USD', null, null, null, null, -1)`), /check|violates/, "negative threshold");
});
await test("anonymous visitors cannot create shops", () =>
  denied(() => call(null, `select public.create_shop('Nope', 'USD')`), /permission denied/));

await call(U.ownerB, `select public.create_shop('Beta Store', 'NGN', 'NG') as id`).then(r => { shopB = r.rows[0].id; });

// Team for shop A (via the real RPCs).
await call(U.ownerA, `select public.invite_member($1, $2, 'admin')`, [shopA, U.adminA.email]);
await call(U.ownerA, `select public.invite_member($1, $2, 'cashier')`, [shopA, U.cashA.email]);
await call(U.adminA, `select public.accept_invite((select invite_id from public.my_invites() limit 1))`);
await call(U.cashA, `select public.accept_invite((select invite_id from public.my_invites() limit 1))`);
await call(U.ownerB, `select public.invite_member($1, $2, 'cashier')`, [shopB, U.cashB.email]);
await call(U.cashB, `select public.accept_invite((select invite_id from public.my_invites() limit 1))`);

// Seed catalog + customers for both shops through the app's own permissions.
const seed = async (owner, shop, tag) => {
  const cat = (await call(owner, `insert into public.categories (shop_id, name) values ($1, 'Drinks') returning id`, [shop])).rows[0].id;
  const prod = (await call(owner, `insert into public.products (shop_id, name, category_id, cost_price, selling_price, stock, barcode) values ($1, $2, $3, 2, 4, 20, '111') returning id`, [shop, `Water ${tag}`, cat])).rows[0].id;
  const cust = (await call(owner, `insert into public.customers (shop_id, name) values ($1, $2) returning id`, [shop, `Cust ${tag}`])).rows[0].id;
  const sup = (await call(owner, `insert into public.suppliers (shop_id, name) values ($1, $2) returning id`, [shop, `Sup ${tag}`])).rows[0].id;
  return { cat, prod, cust, sup };
};
const A = await seed(U.ownerA, shopA, "A");
const B = await seed(U.ownerB, shopB, "B");
const saleA = (await call(U.cashA, `select public.create_sale($1, $2, $3, 'cash', 0, $4::jsonb) as id`, [shopA, U.cashA.id, A.cust, JSON.stringify([{ product_id: A.prod, quantity: 2 }])])).rows[0].id;
const saleB = (await call(U.cashB, `select public.create_sale($1, $2, $3, 'momo', 0, $4::jsonb) as id`, [shopB, U.cashB.id, B.cust, JSON.stringify([{ product_id: B.prod, quantity: 1 }])])).rows[0].id;

// ---- Tenant isolation: reading -----------------------------------------------------------------------
for (const t of ["categories", "products", "customers", "suppliers", "sales", "sale_lines", "stock_movements"]) {
  await test(`isolation: shop B cannot read shop A's ${t}, and still sees its own`, async () => {
    const theirs = (await call(U.ownerB, `select count(*)::int c from public.${t} where shop_id = $1`, [shopA])).rows[0].c;
    const cashTheirs = (await call(U.cashB, `select count(*)::int c from public.${t} where shop_id = $1`, [shopA])).rows[0].c;
    const own = (await call(U.ownerB, `select count(*)::int c from public.${t} where shop_id = $1`, [shopB])).rows[0].c;
    ok(theirs === 0 && cashTheirs === 0, `saw ${theirs}/${cashTheirs} of A's rows`);
    ok(own > 0, "cannot see its own rows");
  });
}
await test("isolation: other shops' settings, team and invitations are invisible", async () => {
  ok((await call(U.ownerB, `select count(*)::int c from public.shops where id = $1`, [shopA])).rows[0].c === 0, "shop row visible");
  ok((await call(U.ownerB, `select count(*)::int c from public.shop_members where shop_id = $1`, [shopA])).rows[0].c === 0, "members visible");
  await call(U.ownerA, `select public.invite_member($1, 'someone@x.test', 'cashier')`, [shopA]);
  ok((await call(U.ownerB, `select count(*)::int c from public.shop_invites where shop_id = $1`, [shopA])).rows[0].c === 0, "invites visible");
});
await test("isolation: profiles are visible only to teammates", async () => {
  const seenByB = (await call(U.ownerB, `select id from public.profiles`)).rows.map(r => r.id);
  ok(!seenByB.includes(U.ownerA.id) && !seenByB.includes(U.cashA.id), "B sees A's people");
  ok(seenByB.includes(U.ownerB.id) && seenByB.includes(U.cashB.id), "B cannot see own team");
  const seenByA = (await call(U.cashA, `select id from public.profiles`)).rows.map(r => r.id);
  ok(seenByA.includes(U.ownerA.id) && seenByA.includes(U.adminA.id) && !seenByA.includes(U.ownerB.id), "A's view wrong");
});
await test("isolation: someone with no shop sees nothing", async () => {
  for (const t of ["shops", "shop_members", "products", "sales", "customers"]) {
    ok((await call(U.newbie, `select count(*)::int c from public.${t}`)).rows[0].c === 0, `saw ${t}`);
  }
});

// ---- Tenant isolation: writing -----------------------------------------------------------------------
await test("isolation: an owner cannot insert into another shop", async () => {
  await denied(() => call(U.ownerB, `insert into public.products (shop_id, name, cost_price, selling_price) values ($1, 'Injected', 1, 2)`, [shopA]), /row-level security/);
  await denied(() => call(U.ownerB, `insert into public.categories (shop_id, name) values ($1, 'Injected')`, [shopA]), /row-level security/);
  await denied(() => call(U.cashB, `insert into public.customers (shop_id, name) values ($1, 'Injected')`, [shopA]), /row-level security/);
});
await test("isolation: an owner cannot edit or delete another shop's rows", async () => {
  ok((await call(U.ownerB, `update public.products set selling_price = 0.01 where id = $1 returning id`, [A.prod])).rows.length === 0, "updated A's product");
  ok((await call(U.ownerB, `delete from public.products where id = $1 returning id`, [A.prod])).rows.length === 0, "deleted A's product");
  ok((await call(U.ownerB, `update public.shops set name = 'Hijacked' where id = $1 returning id`, [shopA])).rows.length === 0, "renamed A's shop");
  ok((await one(`select selling_price::float p from public.products where id = $1`, [A.prod])).p === 4, "price changed");
});
await test("isolation: rows cannot be pointed at another shop's data (composite foreign keys)", async () => {
  await denied(() => call(U.ownerA, `insert into public.products (shop_id, name, category_id, cost_price, selling_price) values ($1, 'X', $2, 1, 2)`, [shopA, B.cat]), /foreign key/, "product -> foreign category");
  await denied(() => call(U.ownerA, `update public.products set category_id = $1 where id = $2`, [B.cat, A.prod]), /foreign key/, "re-point category");
  // sales, sale_lines and stock_movements no longer grant direct writes to anyone (see migration 007),
  // so these two go in as a superuser -- the same trust level as the security-definer RPCs that are the
  // only real writers -- to prove the composite foreign key holds even there.
  await denied(() => q(`insert into public.stock_movements (shop_id, product_id, type, quantity) values ($1, $2, 'in', 1)`, [shopA, B.prod]), /foreign key/, "movement -> foreign product");
  await denied(() => q(`insert into public.sale_lines (shop_id, sale_id, product_id, quantity, unit_price, unit_cost) values ($1, $2, $3, 1, 1, 1)`, [shopA, saleA, B.prod]), /foreign key/, "sale line -> foreign product");
  await denied(() => q(`insert into public.sale_lines (shop_id, sale_id, product_id, quantity, unit_price, unit_cost) values ($1, $2, $3, 1, 1, 1)`, [shopA, saleB, A.prod]), /foreign key/, "sale line -> foreign sale");
});
await test("isolation: even a superuser-level slip cannot move a row between shops", async () => {
  await denied(() => q(`update public.products set shop_id = $1 where id = $2`, [shopB, A.prod]), /shop_id cannot be changed|foreign key/);
});
await test("isolation: barcodes and category names are unique per shop, not globally", async () => {
  await call(U.ownerB, `insert into public.categories (shop_id, name) values ($1, 'Fresh')`, [shopB]);
  await call(U.ownerA, `insert into public.categories (shop_id, name) values ($1, 'Fresh')`, [shopA]); // same name, other shop
  await denied(() => call(U.ownerA, `insert into public.products (shop_id, name, cost_price, selling_price, barcode) values ($1, 'Dup', 1, 2, '111')`, [shopA]), /unique|duplicate/, "same barcode in one shop");
  await call(U.ownerB, `insert into public.products (shop_id, name, cost_price, selling_price, barcode) values ($1, 'SameBarcode', 1, 2, '222')`, [shopB]);
  await call(U.ownerA, `insert into public.products (shop_id, name, cost_price, selling_price, barcode) values ($1, 'SameBarcode', 1, 2, '222')`, [shopA]);
});

// ---- Tenant isolation: the RPCs ----------------------------------------------------------------------
await test("isolation: create_sale refuses another shop, its products, customers and staff", async () => {
  const lines = (p) => JSON.stringify([{ product_id: p, quantity: 1 }]);
  await denied(() => call(U.cashA, `select public.create_sale($1, $2, null, 'cash', 0, $3::jsonb)`, [shopB, U.cashA.id, lines(B.prod)]), /do not have access/, "sell into shop B");
  await denied(() => call(U.cashA, `select public.create_sale($1, $2, null, 'cash', 0, $3::jsonb)`, [shopA, U.cashA.id, lines(B.prod)]), /Product not found/, "sell B's product");
  await denied(() => call(U.cashA, `select public.create_sale($1, $2, $3, 'cash', 0, $4::jsonb)`, [shopA, U.cashA.id, B.cust, lines(A.prod)]), /Customer not found/, "B's customer");
  await denied(() => call(U.cashA, `select public.create_sale($1, $2, null, 'cash', 0, $3::jsonb)`, [shopA, U.cashB.id, lines(A.prod)]), /own name/, "attribute to B's cashier");
});
await test("isolation: a cashier cannot pin a sale on a coworker, but an admin can ring one up for them", async () => {
  const lines = (p) => JSON.stringify([{ product_id: p, quantity: 1 }]);
  await denied(() => call(U.cashA, `select public.create_sale($1, $2, null, 'cash', 0, $3::jsonb)`, [shopA, U.adminA.id, lines(A.prod)]), /own name/, "cashier attributes to admin");
  const id = (await call(U.adminA, `select public.create_sale($1, $2, null, 'cash', 0, $3::jsonb) as id`, [shopA, U.cashA.id, lines(A.prod)])).rows[0].id;
  ok((await one(`select cashier_id from public.sales where id = $1`, [id])).cashier_id === U.cashA.id, "admin's override was not recorded");
});
await test("isolation: record_stock_movement cannot touch another shop's product or supplier", async () => {
  await denied(() => call(U.cashA, `select public.record_stock_movement($1, 'in', 5)`, [B.prod]), /Product not found/);
  await denied(() => call(U.cashA, `select public.record_stock_movement($1, 'in', 5, $2)`, [A.prod, B.sup]), /Supplier not found/);
  ok((await one(`select stock from public.products where id = $1`, [B.prod])).stock === 19, "B's stock changed");
});
await test("anonymous visitors cannot call any RPC", async () => {
  for (const sql of [`select public.create_sale('${shopA}', '${U.cashA.id}', null, 'cash', 0, '[]'::jsonb)`, `select public.record_stock_movement('${A.prod}', 'in', 1)`, `select public.my_invites()`, `select public.invite_member('${shopA}', 'x@y.zz', 'cashier')`, `select public.accept_invite('${uuid(99)}')`, `select public.set_member_role('${shopA}', '${U.cashA.id}', 'admin')`, `select public.remove_member('${shopA}', '${U.cashA.id}')`]) {
    await denied(() => call(null, sql), /permission denied/, sql.slice(0, 40));
  }
});

// ---- Roles inside a shop -----------------------------------------------------------------------------
await test("cashier: can sell, restock, and add customers and suppliers", async () => {
  await call(U.cashA, `select public.create_sale($1, $2, null, 'card', 0, $3::jsonb)`, [shopA, U.cashA.id, JSON.stringify([{ product_id: A.prod, quantity: 1 }])]);
  await call(U.cashA, `select public.record_stock_movement($1, 'in', 3)`, [A.prod]);
  await call(U.cashA, `insert into public.customers (shop_id, name) values ($1, 'Walk-in Regular')`, [shopA]);
  await call(U.cashA, `insert into public.suppliers (shop_id, name) values ($1, 'New Supplier')`, [shopA]);
  await call(U.cashA, `update public.customers set phone = '1' where id = $1`, [A.cust]);
});
await test("cashier: cannot change the catalog, sales history, or delete customers", async () => {
  await denied(() => call(U.cashA, `insert into public.products (shop_id, name, cost_price, selling_price) values ($1, 'Sneaky', 1, 2)`, [shopA]), /row-level security/, "add product");
  await noRows(() => call(U.cashA, `update public.products set selling_price = 0.01 where id = $1 returning id`, [A.prod]), "edit price");
  await noRows(() => call(U.cashA, `delete from public.products where id = $1 returning id`, [A.prod]), "delete product");
  await noRows(() => call(U.cashA, `update public.categories set name = 'x' where id = $1 returning id`, [A.cat]), "edit category");
  await denied(() => call(U.cashA, `update public.sales set total = 0.01 returning id`), /permission denied/, "edit sales");
  await denied(() => call(U.cashA, `delete from public.sales returning id`), /permission denied/, "delete sales");
  await noRows(() => call(U.cashA, `delete from public.customers where id = $1 returning id`, [A.cust]), "delete customer");
  await denied(() => call(U.cashA, `insert into public.sales (shop_id, cashier_id, subtotal, total, payment_method) values ($1, $2, 1, 1, 'cash')`, [shopA, U.cashA.id]), /permission denied/, "forge a sale");
});
await test("admin: cannot write sales, sale lines or stock movements directly either -- only the RPCs can", async () => {
  const saleId = (await call(U.adminA, `select id from public.sales where shop_id = $1 limit 1`, [shopA])).rows[0].id;
  await denied(() => call(U.adminA, `insert into public.sales (shop_id, cashier_id, subtotal, total, payment_method) values ($1, $2, 1, 1, 'cash')`, [shopA, U.adminA.id]), /permission denied/, "admin forges a sale");
  await denied(() => call(U.adminA, `update public.sales set total = 0.01 where id = $1`, [saleId]), /permission denied/, "admin edits a sale");
  await denied(() => call(U.adminA, `delete from public.sales where id = $1`, [saleId]), /permission denied/, "admin deletes a sale");
  await denied(() => call(U.adminA, `insert into public.stock_movements (shop_id, product_id, type, quantity, notes) values ($1, $2, 'in', 1, 'off the books')`, [shopA, A.prod]), /permission denied/, "admin forges a stock movement");
});
await test("cashier: cannot edit shop settings, invite, promote or remove anyone", async () => {
  await noRows(() => call(U.cashA, `update public.shops set name = 'Mine now' where id = $1 returning id`, [shopA]), "rename shop");
  await denied(() => call(U.cashA, `select public.invite_member($1, 'z@z.zz', 'cashier')`, [shopA]), /Only admins/);
  await denied(() => call(U.cashA, `select public.set_member_role($1, $2, 'admin')`, [shopA, U.cashA.id]), /Only the owner/);
  await denied(() => call(U.cashA, `select public.remove_member($1, $2)`, [shopA, U.adminA.id]), /Only admins/);
  ok((await call(U.cashA, `select count(*)::int c from public.shop_invites`)).rows[0].c === 0, "saw pending invitations");
});
await test("admin: manages the catalog and shop settings, but not ownership", async () => {
  const p = (await call(U.adminA, `insert into public.products (shop_id, name, cost_price, selling_price) values ($1, 'Admin Item', 1, 2) returning id`, [shopA])).rows[0].id;
  await call(U.adminA, `update public.products set selling_price = 3 where id = $1`, [p]);
  await call(U.adminA, `delete from public.products where id = $1`, [p]);
  await call(U.adminA, `update public.shops set phone = '055 1' , low_stock_threshold = 9 where id = $1`, [shopA]);
  await denied(() => call(U.adminA, `update public.shops set owner_id = $2 where id = $1`, [shopA, U.adminA.id]), /owner cannot be changed/, "take ownership");
});
await test("admin: can invite and remove cashiers only", async () => {
  await call(U.adminA, `select public.invite_member($1, 'temp.cashier@x.test', 'cashier')`, [shopA]);
  await denied(() => call(U.adminA, `select public.invite_member($1, 'temp.admin@x.test', 'admin')`, [shopA]), /Only the owner can invite admins/);
  await denied(() => call(U.adminA, `select public.set_member_role($1, $2, 'admin')`, [shopA, U.cashA.id]), /Only the owner/);
  await denied(() => call(U.adminA, `select public.remove_member($1, $2)`, [shopA, ownerId(U.ownerA)]), /owner cannot be removed/);
  function ownerId(u) { return u.id; }
});
await test("owner: promotes, demotes and removes staff, but never removes themself or the owner role", async () => {
  await call(U.ownerA, `select public.set_member_role($1, $2, 'admin')`, [shopA, U.cashA.id]);
  ok((await one(`select role from public.shop_members where user_id = $1`, [U.cashA.id])).role === "admin", "not promoted");
  await call(U.ownerA, `select public.set_member_role($1, $2, 'cashier')`, [shopA, U.cashA.id]);
  await denied(() => call(U.ownerA, `select public.set_member_role($1, $2, 'owner')`, [shopA, U.cashA.id]), /exactly one owner/);
  await denied(() => call(U.ownerA, `select public.set_member_role($1, $2, 'cashier')`, [shopA, U.ownerA.id]), /Member not found/, "demote the owner");
  await denied(() => call(U.ownerA, `select public.remove_member($1, $2)`, [shopA, U.ownerA.id]), /cannot remove yourself/);
  await denied(() => call(U.ownerA, `select public.set_member_role($1, $2, 'admin')`, [shopA, U.cashB.id]), /Member not found/, "touch another shop's member");
  await denied(() => call(U.ownerB, `select public.remove_member($1, $2)`, [shopA, U.cashA.id]), /Only admins/, "remove from a foreign shop");
});
await test("profiles: people can rename themselves, but not change email or edit others", async () => {
  await call(U.cashA, `update public.profiles set name = 'Cashier Renamed' where id = $1`, [U.cashA.id]);
  await denied(() => call(U.cashA, `update public.profiles set email = 'spoof@x.test' where id = $1`, [U.cashA.id]), /permission denied/, "change email");
  await noRows(() => call(U.cashA, `update public.profiles set name = 'Hacked' where id = $1 returning id`, [U.ownerA.id]), "rename someone else");
});

// ---- Invitations -------------------------------------------------------------------------------------
await test("invitations: only the addressee can see and accept one (email is case-insensitive)", async () => {
  await call(U.ownerA, `select public.invite_member($1, '  INVITEE@shop.test ', 'cashier')`, [shopA]);
  ok((await call(U.stranger, `select * from public.my_invites()`)).rows.length === 0, "stranger sees the invite");
  const mine = (await call(U.invitee, `select * from public.my_invites()`)).rows;
  ok(mine.length === 1 && mine[0].shop_name === "Alpha Mart" && mine[0].role === "cashier", JSON.stringify(mine));
  await denied(() => call(U.stranger, `select public.accept_invite($1)`, [mine[0].invite_id]), /no longer valid/, "stranger accepts");
  ok((await one(`select count(*)::int c from public.shop_members where user_id = $1`, [U.stranger.id])).c === 0, "stranger joined");
  ok((await call(U.invitee, `select count(*)::int c from public.shop_invites`)).rows[0].c === 0, "invitee reads the invites table directly");
});
await test("invitations: accepting joins the shop with the invited role and consumes the invite", async () => {
  const inv = (await call(U.invitee, `select * from public.my_invites()`)).rows[0];
  const r = await call(U.invitee, `select public.accept_invite($1) as shop`, [inv.invite_id]);
  ok(r.rows[0].shop === shopA, "wrong shop");
  ok((await one(`select role from public.shop_members where user_id = $1`, [U.invitee.id])).role === "cashier", "wrong role");
  ok((await call(U.invitee, `select count(*)::int c from public.products where shop_id = $1`, [shopA])).rows[0].c > 0, "cannot read shop data after joining");
  ok((await call(U.invitee, `select * from public.my_invites()`)).rows.length === 0, "invite still listed");
});
await test("invitations: existing members can't be invited or accept a second shop", async () => {
  await denied(() => call(U.ownerA, `select public.invite_member($1, $2, 'cashier')`, [shopA, U.cashB.email]), /already belongs/);
  await q(`insert into public.shop_invites (shop_id, email, role) values ($1, $2, 'cashier')`, [shopB, U.adminA.email]);
  const inv = (await call(U.adminA, `select * from public.my_invites()`)).rows[0];
  await denied(() => call(U.adminA, `select public.accept_invite($1)`, [inv.invite_id]), /already belong/);
});
await test("invitations: expired invitations disappear and cannot be accepted", async () => {
  const id = (await call(U.ownerB, `select public.invite_member($1, $2, 'cashier') as id`, [shopB, U.stranger.email])).rows[0].id;
  await q(`update public.shop_invites set expires_at = now() - interval '1 day' where id = $1`, [id]);
  ok((await call(U.stranger, `select * from public.my_invites()`)).rows.length === 0, "expired invite listed");
  await denied(() => call(U.stranger, `select public.accept_invite($1)`, [id]), /no longer valid/);
});
await test("invitations: re-inviting refreshes the role, and admins can revoke", async () => {
  await call(U.ownerA, `select public.invite_member($1, 'refresh@x.test', 'cashier')`, [shopA]);
  await call(U.ownerA, `select public.invite_member($1, 'refresh@x.test', 'admin')`, [shopA]);
  const rows = (await call(U.ownerA, `select id, role from public.shop_invites where email = 'refresh@x.test'`)).rows;
  ok(rows.length === 1 && rows[0].role === "admin", JSON.stringify(rows));
  await call(U.adminA, `select public.revoke_invite($1)`, [rows[0].id]);
  await denied(() => call(U.ownerB, `select public.revoke_invite($1)`, [rows[0].id]), /not found/, "revoke a deleted invite");
  await denied(() => call(U.ownerA, `select public.invite_member($1, 'not-an-email', 'cashier')`, [shopA]), /valid email/);
});

// ---- Shop settings -----------------------------------------------------------------------------------
await test("currency: can be changed until the first sale, then it is locked", async () => {
  const fresh = (await call(U.newbie, `select public.create_shop('Fresh Shop', 'USD') as id`)).rows[0].id;
  await call(U.newbie, `update public.shops set currency = 'EUR' where id = $1`, [fresh]);
  ok((await one(`select currency from public.shops where id = $1`, [fresh])).currency === "EUR", "not changed");
  await denied(() => call(U.ownerA, `update public.shops set currency = 'USD' where id = $1`, [shopA]), /currency cannot be changed/, "change after sales");
  await call(U.ownerA, `update public.shops set name = 'Alpha Mart Renamed', address = 'Kumasi' where id = $1`, [shopA]);
  await call(U.ownerA, `update public.shops set name = 'Alpha Mart' where id = $1`, [shopA]);
});
await test("loyalty: points follow the shop's rate, and stop when switched off", async () => {
  const pts = async () => (await one(`select loyalty_points p from public.customers where id = $1`, [A.cust])).p;
  const sell = (qty) => call(U.cashA, `select public.create_sale($1, $2, $3, 'cash', 0, $4::jsonb)`, [shopA, U.cashA.id, A.cust, JSON.stringify([{ product_id: A.prod, quantity: qty }])]);
  await q(`update public.products set selling_price = 5, stock = 100 where id = $1`, [A.prod]);
  const before = await pts();
  await sell(5); // total 25, 1 point per 10 => 2
  ok((await pts()) === before + 2, `expected +2, got +${(await pts()) - before}`);
  await call(U.ownerA, `update public.shops set loyalty_spend_per_point = 5 where id = $1`, [shopA]);
  const mid = await pts(); await sell(5); // 25 / 5 => 5
  ok((await pts()) === mid + 5, `expected +5, got +${(await pts()) - mid}`);
  await call(U.ownerA, `update public.shops set loyalty_enabled = false where id = $1`, [shopA]);
  const off = await pts(); await sell(5);
  ok((await pts()) === off, "points awarded while switched off");
});
await test("checkout: uses catalog prices, is atomic, and recounts to zero", async () => {
  const before = (await one(`select stock from public.products where id = $1`, [A.prod])).stock;
  const salesBefore = (await one(`select count(*)::int c from public.sales where shop_id = $1`, [shopA])).c;
  await denied(() => call(U.cashA, `select public.create_sale($1, $2, null, 'cash', 0, $3::jsonb)`, [shopA, U.cashA.id, JSON.stringify([{ product_id: A.prod, quantity: 9999 }])]), /Insufficient stock/);
  ok((await one(`select stock from public.products where id = $1`, [A.prod])).stock === before, "stock changed on failure");
  ok((await one(`select count(*)::int c from public.sales where shop_id = $1`, [shopA])).c === salesBefore, "partial sale left behind");
  await call(U.cashA, `select public.record_stock_movement($1, 'adjustment', 0)`, [A.prod]);
  ok((await one(`select stock from public.products where id = $1`, [A.prod])).stock === 0, "recount to zero failed");
});

// ---- Pack sizes --------------------------------------------------------------------------------------
// Products are priced and counted per single item; a pack size sells a fixed number of them at its own price.
const packProd = async (owner, shop, name, stock = 100) =>
  (await call(owner, `insert into public.products (shop_id, name, cost_price, selling_price, stock) values ($1, $2, 2, 4, $3) returning id`, [shop, name, stock])).rows[0].id;
const packA = await packProd(U.ownerA, shopA, "Pack Water A");
const packB = await packProd(U.ownerB, shopB, "Pack Water B");
const unitOf = async (owner, shop, product, name, quantity, price) =>
  (await call(owner, `insert into public.product_units (shop_id, product_id, name, quantity, selling_price) values ($1, $2, $3, $4, $5) returning id`, [shop, product, name, quantity, price])).rows[0].id;
const packUnitA = await unitOf(U.ownerA, shopA, packA, "Pack", 12, 40);
const packUnitB = await unitOf(U.ownerB, shopB, packB, "Pack", 6, 20);
const sellLines = (user, shop, lines) => call(user, `select public.create_sale($1, $2, null, 'cash', 0, $3::jsonb) as id`, [shop, user.id, JSON.stringify(lines)]);

await test("packs: admins add, edit and delete pack sizes; cashiers can only read them", async () => {
  const extra = (await call(U.adminA, `insert into public.product_units (shop_id, product_id, name, quantity, selling_price) values ($1, $2, 'Box', 48, 150) returning id`, [shopA, packA])).rows[0].id;
  await call(U.adminA, `update public.product_units set selling_price = 140 where id = $1`, [extra]);
  ok((await call(U.cashA, `select count(*)::int c from public.product_units where shop_id = $1`, [shopA])).rows[0].c === 2, "cashier cannot read");
  await denied(() => call(U.cashA, `insert into public.product_units (shop_id, product_id, name, quantity, selling_price) values ($1, $2, 'Sneaky', 3, 1)`, [shopA, packA]), /row-level security/, "cashier adds");
  await noRows(() => call(U.cashA, `update public.product_units set selling_price = 0.01 where id = $1 returning id`, [extra]), "cashier edits");
  await noRows(() => call(U.cashA, `delete from public.product_units where id = $1 returning id`, [extra]), "cashier deletes");
  await call(U.adminA, `delete from public.product_units where id = $1`, [extra]);
});
await test("packs: a size needs 2 or more items, a price, a name, and can't repeat on a product", async () => {
  const add = (name, quantity, price) => call(U.ownerA, `insert into public.product_units (shop_id, product_id, name, quantity, selling_price) values ($1, $2, $3, $4, $5)`, [shopA, packA, name, quantity, price]);
  await denied(() => add("One", 1, 5), /check|violates/, "pack of 1");
  await denied(() => add("Free", 3, 0), /check|violates/, "free pack");
  await denied(() => add("   ", 3, 5), /check|violates/, "blank name");
  await denied(() => add("Pack", 3, 5), /unique|duplicate/, "same name twice");
  await denied(() => add("Dozen", 12, 5), /unique|duplicate/, "same size twice");
});
await test("packs: isolation: another shop cannot read, add, edit or point at them", async () => {
  ok((await call(U.ownerB, `select count(*)::int c from public.product_units where shop_id = $1`, [shopA])).rows[0].c === 0, "B reads A's packs");
  ok((await call(U.ownerB, `select count(*)::int c from public.product_units where shop_id = $1`, [shopB])).rows[0].c >= 1, "B cannot read its own");
  await denied(() => call(U.ownerB, `insert into public.product_units (shop_id, product_id, name, quantity, selling_price) values ($1, $2, 'Injected', 3, 1)`, [shopA, packA]), /row-level security/, "insert into A");
  await denied(() => call(U.ownerB, `insert into public.product_units (shop_id, product_id, name, quantity, selling_price) values ($1, $2, 'Crossed', 3, 1)`, [shopB, packA]), /foreign key/, "B's shop, A's product");
  await noRows(() => call(U.ownerB, `update public.product_units set selling_price = 0.01 where id = $1 returning id`, [packUnitA]), "edit A's pack");
  await noRows(() => call(U.ownerB, `delete from public.product_units where id = $1 returning id`, [packUnitA]), "delete A's pack");
  await denied(() => q(`update public.product_units set shop_id = $1 where id = $2`, [shopB, packUnitA]), /shop_id cannot be changed|foreign key/, "move a pack between shops");
});
await test("packs: a barcode names one thing, a product or a pack size, never both", async () => {
  await call(U.ownerA, `update public.product_units set barcode = 'PK-777' where id = $1`, [packUnitA]);
  await denied(() => call(U.ownerA, `update public.products set barcode = 'PK-777' where id = $1`, [packA]), /already uses the barcode/, "product takes a pack's barcode");
  await denied(() => call(U.ownerA, `insert into public.products (shop_id, name, cost_price, selling_price, barcode) values ($1, 'Clash', 1, 2, 'PK-777')`, [shopA]), /already uses the barcode/, "new product takes a pack's barcode");
  await denied(() => call(U.ownerA, `update public.product_units set barcode = '111' where id = $1`, [packUnitA]), /already uses the barcode/, "pack takes a product's barcode");
  await call(U.ownerB, `update public.products set barcode = 'PK-777' where id = $1`, [packB]);   // the same code in another shop is fine
  await call(U.ownerA, `update public.product_units set barcode = null where id = $1`, [packUnitA]);
});
await test("checkout: a pack charges the pack's own price and takes the whole pack out of stock", async () => {
  const before = (await one(`select stock from public.products where id = $1`, [packA])).stock;
  const id = (await sellLines(U.cashA, shopA, [{ product_id: packA, quantity: 2, unit_id: packUnitA }])).rows[0].id;
  ok((await one(`select stock from public.products where id = $1`, [packA])).stock === before - 24, "stock did not fall by 2 x 12");
  const sale = await one(`select subtotal::float s, total::float t from public.sales where id = $1`, [id]);
  ok(sale.s === 80 && sale.t === 80, JSON.stringify(sale));
  const line = await one(`select quantity, unit_price::float p, unit_cost::float c, unit_quantity, unit_name, unit_id from public.sale_lines where sale_id = $1`, [id]);
  ok(line.quantity === 2 && line.p === 40 && line.c === 24 && line.unit_quantity === 12 && line.unit_name === "Pack" && line.unit_id === packUnitA, JSON.stringify(line));
  const move = await one(`select type, quantity, notes from public.stock_movements where notes like $1`, [`Sale ${id}%`]);
  ok(move.type === "out" && move.quantity === 24, JSON.stringify(move));
});
await test("checkout: singles and packs of one product are counted together against stock", async () => {
  await q(`update public.products set stock = 30 where id = $1`, [packA]);
  await denied(() => sellLines(U.cashA, shopA, [{ product_id: packA, quantity: 2, unit_id: packUnitA }, { product_id: packA, quantity: 7 }]), /Insufficient stock/, "31 items from 30");
  ok((await one(`select stock from public.products where id = $1`, [packA])).stock === 30, "stock changed on refusal");
  await sellLines(U.cashA, shopA, [{ product_id: packA, quantity: 2, unit_id: packUnitA }, { product_id: packA, quantity: 6 }]);
  ok((await one(`select stock from public.products where id = $1`, [packA])).stock === 0, "30 items from 30 should leave 0");
  await q(`update public.products set stock = 100 where id = $1`, [packA]);
});
await test("checkout: a pack can't be bigger than what is in stock", async () => {
  await q(`update public.products set stock = 11 where id = $1`, [packA]);
  await denied(() => sellLines(U.cashA, shopA, [{ product_id: packA, quantity: 1, unit_id: packUnitA }]), /Insufficient stock/, "a pack of 12 from 11 items");
  await q(`update public.products set stock = 100 where id = $1`, [packA]);
});
await test("checkout: the client can't use another product's or another shop's pack size", async () => {
  const other = await packProd(U.ownerA, shopA, "Pack Other A");
  await denied(() => sellLines(U.cashA, shopA, [{ product_id: other, quantity: 1, unit_id: packUnitA }]), /Pack size not found/, "another product's pack");
  await denied(() => sellLines(U.cashA, shopA, [{ product_id: packA, quantity: 1, unit_id: packUnitB }]), /Pack size not found/, "another shop's pack");
  await denied(() => sellLines(U.cashA, shopA, [{ product_id: packA, quantity: 1, unit_id: uuid(555) }]), /Pack size not found/, "an unknown pack");
  await denied(() => sellLines(U.cashA, shopA, [{ product_id: packA, quantity: 0, unit_id: packUnitA }]), /must be positive/, "zero packs");
});
await test("checkout: the pack's current price is used, not one the client sends", async () => {
  await call(U.ownerA, `update public.product_units set selling_price = 45 where id = $1`, [packUnitA]);
  const id = (await sellLines(U.cashA, shopA, [{ product_id: packA, quantity: 1, unit_id: packUnitA, unit_price: 0.01 }])).rows[0].id;
  ok((await one(`select total::float t from public.sales where id = $1`, [id])).t === 45, "client price accepted");
  await call(U.ownerA, `update public.product_units set selling_price = 40 where id = $1`, [packUnitA]);
});
await test("packs: deleting a pack size keeps past sales readable", async () => {
  const temp = await unitOf(U.ownerA, shopA, packA, "Carton", 24, 70);
  const id = (await sellLines(U.cashA, shopA, [{ product_id: packA, quantity: 1, unit_id: temp }])).rows[0].id;
  await call(U.ownerA, `delete from public.product_units where id = $1`, [temp]);
  const line = await one(`select unit_id, unit_name, unit_quantity, quantity, unit_price::float p from public.sale_lines where sale_id = $1`, [id]);
  ok(line.unit_id === null && line.unit_name === "Carton" && line.unit_quantity === 24 && line.p === 70, JSON.stringify(line));
});
await test("packs: deleting a product removes its pack sizes; a sold product still can't be deleted", async () => {
  const lone = await packProd(U.ownerA, shopA, "Pack Lonely");
  await unitOf(U.ownerA, shopA, lone, "Pack", 6, 20);
  await call(U.ownerA, `delete from public.products where id = $1`, [lone]);
  ok((await one(`select count(*)::int c from public.product_units where product_id = $1`, [lone])).c === 0, "orphan pack sizes left behind");
  await denied(() => call(U.ownerA, `delete from public.products where id = $1`, [packA]), /foreign key/, "delete a sold product");
});
await test("packs: old clients that send no pack size keep selling singles at the single price", async () => {
  const before = (await one(`select stock from public.products where id = $1`, [packA])).stock;
  const id = (await sellLines(U.cashA, shopA, [{ product_id: packA, quantity: 3 }])).rows[0].id;
  const line = await one(`select unit_id, unit_name, unit_quantity, unit_price::float p, unit_cost::float c from public.sale_lines where sale_id = $1`, [id]);
  ok(line.unit_id === null && line.unit_name === null && line.unit_quantity === 1 && line.p === 4 && line.c === 2, JSON.stringify(line));
  ok((await one(`select stock from public.products where id = $1`, [packA])).stock === before - 3, "stock");
});

// ---- Bulk entry (migration 008) ----------------------------------------------------------------------
const importRows = (rows) => JSON.stringify(rows);
const countNamed = async (shop, like) => (await one(`select count(*)::int c from public.products where shop_id = $1 and name like $2`, [shop, like])).c;
await test("bulk import: only admins and owners can import products", async () => {
  const rows = importRows([{ name: "BULK Cashier Try", cost_price: 1, selling_price: 2 }]);
  await denied(() => call(U.cashA, `select public.bulk_import_products($1, $2::jsonb)`, [shopA, rows]), /Only admins/, "cashier imports");
  await denied(() => call(U.ownerB, `select public.bulk_import_products($1, $2::jsonb)`, [shopA, rows]), /Only admins/, "another shop's owner imports");
  await denied(() => call(null, `select public.bulk_import_products($1, $2::jsonb)`, [shopA, rows]), /permission denied/, "visitor imports");
  ok((await countNamed(shopA, "BULK%")) === 0, "something was created");
});
await test("bulk import: creates products, new categories (once) and pack sizes; re-uploading adds nothing", async () => {
  const rows = importRows([
    { name: "BULK Milk", category: "Dairy", cost_price: 8, selling_price: 12.5, stock: 20, barcode: "BULK-1", packs: [{ name: "Carton", quantity: 24, selling_price: 260, barcode: "BULK-C" }, { name: "Pack", quantity: 6, selling_price: 70, barcode: null }] },
    { name: "  BULK   Cheese ", category: "dairy", cost_price: 3, selling_price: 5 },
    { name: "BULK Water", category: "Drinks", cost_price: 1, selling_price: 2, stock: 5 },
  ]);
  const first = (await call(U.adminA, `select public.bulk_import_products($1, $2::jsonb) as r`, [shopA, rows])).rows[0].r;
  ok(first.products === 3 && first.packs === 2 && first.categories === 1 && first.skipped === 0, JSON.stringify(first));
  const cats = (await q(`select name from public.categories where shop_id = $1 and lower(name) in ('dairy','drinks') order by name`, [shopA])).rows.map(r => r.name);
  ok(cats.join() === "Dairy,Drinks", cats.join());
  const milk = await one(`select p.stock, c.name cat, (select count(*)::int from public.product_units u where u.product_id = p.id) packs from public.products p join public.categories c on c.id = p.category_id where p.shop_id = $1 and p.name = 'BULK Milk'`, [shopA]);
  ok(milk.stock === 20 && milk.cat === "Dairy" && milk.packs === 2, JSON.stringify(milk));
  ok((await countNamed(shopA, "BULK Cheese")) === 1, "name was not tidied");
  const again = (await call(U.adminA, `select public.bulk_import_products($1, $2::jsonb) as r`, [shopA, rows])).rows[0].r;
  ok(again.products === 0 && again.skipped === 3 && again.categories === 0, JSON.stringify(again));
  ok((await countNamed(shopA, "BULK%")) === 3, "a duplicate was created");
});
await test("bulk import: one bad row rolls back the whole file and names the row", async () => {
  const before = await countNamed(shopA, "ATOMIC%");
  await denied(() => call(U.adminA, `select public.bulk_import_products($1, $2::jsonb)`, [shopA, importRows([
    { name: "ATOMIC One", category: "Never made", cost_price: 1, selling_price: 2 },
    { name: "ATOMIC Two", cost_price: 1, selling_price: 0 },
  ])]), /Row 2:/, "free product");
  await denied(() => call(U.adminA, `select public.bulk_import_products($1, $2::jsonb)`, [shopA, importRows([
    { name: "ATOMIC Three", cost_price: 1, selling_price: 2, barcode: "111" },
  ])]), /Row 1:/, "barcode taken by a product");
  await denied(() => call(U.adminA, `select public.bulk_import_products($1, $2::jsonb)`, [shopA, importRows([
    { name: "ATOMIC Four", cost_price: 1, selling_price: 2, packs: [{ name: "Box", quantity: 1, selling_price: 5 }] },
  ])]), /Row 1:/, "pack of one");
  await denied(() => call(U.adminA, `select public.bulk_import_products($1, $2::jsonb)`, [shopA, importRows([
    { name: "ATOMIC Five", cost_price: 1, selling_price: 2, barcode: "BULK-1" },
  ])]), /Row 1:/, "barcode taken by another import");
  await denied(() => call(U.adminA, `select public.bulk_import_products($1, $2::jsonb)`, [shopA, importRows([{ name: "ATOMIC Six", cost_price: "abc", selling_price: 2 }])]), /Row 1:/, "text for a price");
  ok((await countNamed(shopA, "ATOMIC%")) === before, "part of a failed file was kept");
  ok((await one(`select count(*)::int c from public.categories where shop_id = $1 and name = 'Never made'`, [shopA])).c === 0, "a category from a failed file was kept");
});
await test("bulk import: empty, oversized and malformed input is refused", async () => {
  await denied(() => call(U.adminA, `select public.bulk_import_products($1, '[]'::jsonb)`, [shopA]), /no rows/);
  await denied(() => call(U.adminA, `select public.bulk_import_products($1, '{"a":1}'::jsonb)`, [shopA]), /no rows/);
  await denied(() => call(U.adminA, `select public.bulk_import_products($1, $2::jsonb)`, [shopA, JSON.stringify(Array.from({ length: 2001 }, (_, i) => ({ name: `X${i}`, cost_price: 1, selling_price: 2 })))]), /at most 2000/);
  await denied(() => call(U.adminA, `select public.bulk_import_products($1, '[5]'::jsonb)`, [shopA]), /Row 1:/);
});

await test("bulk stock: any member can record many movements in order, with suppliers and notes", async () => {
  const milk = (await one(`select id from public.products where shop_id = $1 and name = 'BULK Milk'`, [shopA])).id;
  const water = (await one(`select id from public.products where shop_id = $1 and name = 'BULK Water'`, [shopA])).id;
  const n = (await call(U.cashA, `select public.bulk_record_stock($1, $2::jsonb) as n`, [shopA, importRows([
    { product_id: milk, type: "in", quantity: 48, supplier_id: A.sup, notes: "Weekly delivery" },
    { product_id: milk, type: "out", quantity: 8, supplier_id: null, notes: null },
    { product_id: water, type: "adjustment", quantity: 11 },
  ])])).rows[0].n;
  ok(n === 3, `n=${n}`);
  ok((await one(`select stock from public.products where id = $1`, [milk])).stock === 60, "milk stock");
  ok((await one(`select stock from public.products where id = $1`, [water])).stock === 11, "water stock");
  const moves = (await q(`select type, quantity, supplier_id, notes from public.stock_movements where product_id = $1 order by created_at, type`, [milk])).rows;
  ok(moves.some(m => m.type === "in" && m.quantity === 48 && m.supplier_id === A.sup && m.notes === "Weekly delivery"), JSON.stringify(moves));
});
await test("bulk stock: one bad row rolls back every row before it", async () => {
  const milk = (await one(`select id, stock from public.products where shop_id = $1 and name = 'BULK Milk'`, [shopA]));
  const movesBefore = (await one(`select count(*)::int c from public.stock_movements where product_id = $1`, [milk.id])).c;
  await denied(() => call(U.cashA, `select public.bulk_record_stock($1, $2::jsonb)`, [shopA, importRows([
    { product_id: milk.id, type: "in", quantity: 5 },
    { product_id: milk.id, type: "out", quantity: 99999 },
  ])]), /Row 2: Insufficient stock/, "take out more than there is");
  await denied(() => call(U.cashA, `select public.bulk_record_stock($1, $2::jsonb)`, [shopA, importRows([
    { product_id: milk.id, type: "in", quantity: 5, supplier_id: B.sup },
  ])]), /Row 1: Supplier not found/, "another shop's supplier");
  await denied(() => call(U.cashA, `select public.bulk_record_stock($1, $2::jsonb)`, [shopA, importRows([{ product_id: milk.id, type: "in", quantity: 0 }])]), /Row 1:/, "zero quantity");
  await denied(() => call(U.cashA, `select public.bulk_record_stock($1, $2::jsonb)`, [shopA, importRows([{ product_id: milk.id, type: "sideways", quantity: 1 }])]), /Row 1:/, "unknown type");
  ok((await one(`select stock from public.products where id = $1`, [milk.id])).stock === milk.stock, "stock changed by a failed file");
  ok((await one(`select count(*)::int c from public.stock_movements where product_id = $1`, [milk.id])).c === movesBefore, "a movement was kept");
});
await test("bulk stock: cannot touch another shop's products or be called by outsiders", async () => {
  await denied(() => call(U.cashA, `select public.bulk_record_stock($1, $2::jsonb)`, [shopA, importRows([{ product_id: B.prod, type: "in", quantity: 1 }])]), /Row 1: Product not found/, "B's product through A");
  await denied(() => call(U.cashA, `select public.bulk_record_stock($1, $2::jsonb)`, [shopB, importRows([{ product_id: B.prod, type: "in", quantity: 1 }])]), /do not have access/, "into shop B");
  await denied(() => call(null, `select public.bulk_record_stock($1, $2::jsonb)`, [shopA, importRows([{ product_id: A.prod, type: "in", quantity: 1 }])]), /permission denied/, "visitor");
  await denied(() => call(U.cashA, `select public.bulk_record_stock($1, '[]'::jsonb)`, [shopA]), /no rows/);
  ok((await one(`select stock from public.products where id = $1`, [B.prod])).stock === 19, "B's stock changed");
});

// ---- Retail prices (migration 009) ---------------------------------------------------------------------
await test("retail price: admins set it, cashiers cannot, and it must be above zero", async () => {
  const id = (await call(U.adminA, `insert into public.products (shop_id, name, cost_price, selling_price, retail_price, stock) values ($1, 'RETAIL Item', 2, 4, 6, 50) returning id`, [shopA])).rows[0].id;
  ok(Number((await one(`select retail_price from public.products where id = $1`, [id])).retail_price) === 6, "not stored");
  await noRows(() => call(U.cashA, `update public.products set retail_price = 1 where id = $1 returning id`, [id]), "cashier edits retail price");
  await denied(() => call(U.adminA, `update public.products set retail_price = 0 where id = $1`, [id]), /check|violates/, "zero retail price");
  await call(U.adminA, `update public.products set retail_price = null where id = $1`, [id]);
  await call(U.adminA, `update public.products set retail_price = 6 where id = $1`, [id]);
  ok(Number((await one(`select retail_price from public.products where id = $1`, [id])).retail_price) === 6, "reset failed");
});
await test("retail price: a retail line is charged the retail price, everything else the regular price, and the tier is recorded", async () => {
  const item = (await one(`select id from public.products where shop_id = $1 and name = 'RETAIL Item'`, [shopA])).id;
  const plain = (await call(U.adminA, `insert into public.products (shop_id, name, cost_price, selling_price, stock) values ($1, 'RETAIL Plain', 1, 3, 50) returning id`, [shopA])).rows[0].id;
  const packed = (await call(U.adminA, `insert into public.products (shop_id, name, cost_price, selling_price, retail_price, stock) values ($1, 'RETAIL Packed', 1, 3, 9, 100) returning id`, [shopA])).rows[0].id;
  const pack = (await call(U.adminA, `insert into public.product_units (shop_id, product_id, name, quantity, selling_price) values ($1, $2, 'Box', 10, 25) returning id`, [shopA, packed])).rows[0].id;
  const sell = async (lines) => (await call(U.cashA, `select public.create_sale($1, $2, null, 'cash', 0, $3::jsonb) as id`, [shopA, U.cashA.id, JSON.stringify(lines)])).rows[0].id;
  const lineRows = async (id) => (await q(`select p.name, l.quantity, l.unit_price::float up, l.price_tier from public.sale_lines l join public.products p on p.id = l.product_id where l.sale_id = $1 order by p.name, l.unit_price`, [id])).rows;

  const retailSale = await sell([
    { product_id: item, quantity: 2, price_tier: "retail" },
    { product_id: plain, quantity: 1, price_tier: "retail" },
    { product_id: packed, quantity: 1, unit_id: pack, price_tier: "retail" },
    { product_id: packed, quantity: 3, price_tier: "retail" },
  ]);
  const retail = await lineRows(retailSale);
  ok(JSON.stringify(retail.map(r => [r.name, r.up, r.price_tier])) === JSON.stringify([["RETAIL Item", 6, "retail"], ["RETAIL Packed", 9, "retail"], ["RETAIL Packed", 25, "regular"], ["RETAIL Plain", 3, "regular"]]), JSON.stringify(retail));
  ok(Number((await one(`select total from public.sales where id = $1`, [retailSale])).total) === 12 + 3 + 25 + 27, "retail total");

  const regularSale = await sell([{ product_id: item, quantity: 2 }, { product_id: item, quantity: 1, price_tier: "regular" }, { product_id: packed, quantity: 1, price_tier: "" }]);
  const regular = await lineRows(regularSale);
  ok(regular.every(r => r.price_tier === "regular") && regular.filter(r => r.name === "RETAIL Item").every(r => r.up === 4), JSON.stringify(regular));
  ok(Number((await one(`select total from public.sales where id = $1`, [regularSale])).total) === 8 + 4 + 3, "regular total");

  await denied(() => sell([{ product_id: item, quantity: 1, price_tier: "wholesale" }]), /Unknown price tier/, "made-up tier");
  ok((await one(`select stock from public.products where id = $1`, [item])).stock === 50 - 2 - 3, "a refused sale took stock");
});
await test("retail price: bulk import stores it and ignores a blank one", async () => {
  await call(U.adminA, `select public.bulk_import_products($1, $2::jsonb)`, [shopA, JSON.stringify([
    { name: "RETAIL Imported", cost_price: 1, selling_price: 4, retail_price: 5 },
    { name: "RETAIL Imported Blank", cost_price: 1, selling_price: 4, retail_price: "" },
    { name: "RETAIL Imported Null", cost_price: 1, selling_price: 4, retail_price: null },
  ])]);
  const rows = (await q(`select name, retail_price::float r from public.products where shop_id = $1 and name like 'RETAIL Imported%' order by name`, [shopA])).rows;
  ok(JSON.stringify(rows.map(r => [r.name, r.r])) === JSON.stringify([["RETAIL Imported", 5], ["RETAIL Imported Blank", null], ["RETAIL Imported Null", null]]), JSON.stringify(rows));
  await denied(() => call(U.adminA, `select public.bulk_import_products($1, $2::jsonb)`, [shopA, JSON.stringify([{ name: "RETAIL Bad", cost_price: 1, selling_price: 4, retail_price: 0 }])]), /Row 1:/, "zero retail price");
});

// ---- Legacy data (upgrade path only) -----------------------------------------------------------------
if (legacySeed) {
  await test("upgrade: existing data moved into a first shop with nothing lost", async () => {
    const counts = await one(`select
      (select count(*)::int from public.products where name like 'Legacy%') p,
      (select count(*)::int from public.sales where cashier_id in ('${uuid(101)}','${uuid(102)}')) s,
      (select count(*)::int from public.sale_lines l join public.sales s2 on s2.id = l.sale_id where s2.cashier_id in ('${uuid(101)}','${uuid(102)}')) l,
      (select count(*)::int from public.customers where name like 'Legacy%') c,
      (select count(*)::int from public.stock_movements m join public.products p on p.id = m.product_id where p.name like 'Legacy%') m`);
    ok(counts.p === 3 && counts.s === 2 && counts.l === 3 && counts.c === 2 && counts.m === 4, JSON.stringify(counts));
    const nulls = await one(`select
      (select count(*)::int from public.products where shop_id is null) a,
      (select count(*)::int from public.sales where shop_id is null) b`);
    ok(nulls.a === 0 && nulls.b === 0, "rows without a shop");
  });
  await test("upgrade: the old admin became owner, the old cashier a cashier, in one shop named 'My Shop'", async () => {
    const shop = await one(`select s.id, s.name, s.currency, s.owner_id from public.shops s join public.shop_members m on m.shop_id = s.id where m.user_id = '${uuid(101)}'`);
    ok(shop.name === "My Shop" && shop.currency === "GHS" && shop.owner_id === uuid(101), JSON.stringify(shop));
    const roles = (await q(`select user_id, role from public.shop_members where shop_id = $1 order by role`, [shop.id])).rows;
    ok(roles.length === 2, JSON.stringify(roles));
    ok(roles.find(r => r.user_id === uuid(101)).role === "owner" && roles.find(r => r.user_id === uuid(102)).role === "cashier", JSON.stringify(roles));
  });
  await test("upgrade: the legacy shop works for its people and stays sealed from other shops", async () => {
    const legacyCashier = { id: uuid(102), email: "legacy.cashier@old.test" };
    const legacyOwner = { id: uuid(101), email: "legacy.admin@old.test" };
    const shop = (await one(`select shop_id from public.shop_members where user_id = '${uuid(101)}'`)).shop_id;
    const prod = (await one(`select id from public.products where name = 'Legacy Water'`)).id;
    await call(legacyCashier, `select public.create_sale($1, $2, null, 'cash', 0, $3::jsonb)`, [shop, legacyCashier.id, JSON.stringify([{ product_id: prod, quantity: 1 }])]);
    ok((await call(legacyOwner, `select count(*)::int c from public.products where shop_id = $1`, [shop])).rows[0].c >= 3, "owner cannot read");
    ok((await call(U.ownerB, `select count(*)::int c from public.products where shop_id = $1`, [shop])).rows[0].c === 0, "other shop can read legacy data");
    await denied(() => call(legacyCashier, `update public.products set selling_price = 0.01 where id = $1 returning id`, [prod]).then(r => { if (r.rows.length) throw new Error("edited"); throw new Error("no-op"); }), /edited|no-op/);
  });
}

// ---- Report ------------------------------------------------------------------------------------------
console.log(`\n=== ${label} ===`);
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : `\n        -> ${r.detail}`}`);
const passed = results.filter(r => r.pass).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
