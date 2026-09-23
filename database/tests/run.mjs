// Runs the database test suite against an in-memory Postgres (PGlite) that imitates Supabase's roles
// and JWT claims. No Supabase project or network is needed.
//
//   npm run test:db
//
// Three scenarios are exercised with the same tenancy/roles/invitations checks:
//   1. a fresh install of schema.v2.sql
//   2. an existing single-shop database (with data) upgraded by migrations 004 and 006
//   3. an empty database upgraded by migrations 004 and 006
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const database = path.resolve(here, "..");
const schema = path.join(database, "schema.v2.sql");
const migration = path.join(database, "migrations", "004_multi_tenant_shops.sql");
const packSizes = path.join(database, "migrations", "006_product_units.sql");
const before = path.join(here, "fixtures", "schema_before_shops.sql");
const legacySeed = path.join(here, "fixtures", "legacy_seed.sql");
const suite = path.join(here, "tenancy.mjs");

const scenarios = [
  ["Fresh install of schema.v2.sql", [schema]],
  ["Upgrade of a single-shop database with data (migrations 004, 006)", ["--legacy", legacySeed, before, migration, packSizes]],
  ["Upgrade of an empty single-shop database (migrations 004, 006)", [before, migration, packSizes]],
];

let failed = 0;
for (const [label, args] of scenarios) {
  const result = spawnSync(process.execPath, [suite, label, ...args], { encoding: "utf8" });
  const lines = result.stdout.split("\n").filter((line) => /^(===|FAIL|\s+->|\d+\/\d+ passed)/.test(line));
  console.log(lines.join("\n"));
  if (result.status !== 0) {
    failed += 1;
    if (result.stderr) console.error(result.stderr.split("\n").slice(0, 8).join("\n"));
  }
}

if (failed > 0) {
  console.error(`\n${failed} scenario(s) failed`);
  process.exit(1);
}
console.log("\nAll database scenarios passed.");
