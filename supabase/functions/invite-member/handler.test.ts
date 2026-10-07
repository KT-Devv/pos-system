import assert from "node:assert";
import { describe, test } from "node:test";
import { handleInvite, type InviteDeps } from "./handler.ts";

function deps(overrides: Partial<InviteDeps> = {}) {
  const calls: string[] = [];
  const base: InviteDeps = {
    async saveInvitation(args) { calls.push(`save ${args.email} ${args.role} ${args.shopId}`); return { error: null }; },
    async emailInvitation(args) { calls.push(`email ${args.email} ${args.redirectTo ?? "-"}`); return { error: null }; },
  };
  return { calls, deps: { ...base, ...overrides } };
}
const good = { shopId: "shop-1", email: "  New.Cashier@Example.COM ", role: "cashier", redirectTo: "https://shop.example/reset-password" };

describe("invite-member", () => {
  test("saves the invitation as the caller, then emails the cleaned-up address", async () => {
    const { calls, deps: d } = deps();
    const result = await handleInvite(good, true, d);
    assert.deepStrictEqual(result, { status: 200, body: { invited: true, emailed: true } });
    assert.deepStrictEqual(calls, ["save new.cashier@example.com cashier shop-1", "email new.cashier@example.com https://shop.example/reset-password"]);
  });

  test("never emails when the database refuses the invitation", async () => {
    const { calls, deps: d } = deps({ async saveInvitation() { return { error: "Only admins can invite people" }; } });
    const result = await handleInvite(good, true, d);
    assert.deepStrictEqual(result, { status: 400, body: { error: "Only admins can invite people" } });
    assert.deepStrictEqual(calls, []);
  });

  test("refuses callers who are not signed in, and malformed requests, before touching anything", async () => {
    const { calls, deps: d } = deps();
    assert.strictEqual((await handleInvite(good, false, d)).status, 401);
    assert.strictEqual((await handleInvite(null, true, d)).status, 400);
    assert.strictEqual((await handleInvite({ shopId: "s", email: "a@b.co" }, true, d)).status, 400);
    assert.strictEqual((await handleInvite({ ...good, role: 5 }, true, d)).status, 400);
    assert.strictEqual((await handleInvite({ ...good, email: "not an email" }, true, d)).status, 400);
    assert.deepStrictEqual(calls, []);
  });

  test("an existing account is not an error: the invitation stands and they just sign in", async () => {
    const { deps: d } = deps({ async emailInvitation() { return { error: { message: "A user with this email address has already been registered", code: "email_exists" } }; } });
    assert.deepStrictEqual(await handleInvite(good, true, d), { status: 200, body: { invited: true, emailed: false, reason: "existing-account" } });
    const older = deps({ async emailInvitation() { return { error: { message: "User already registered" } }; } });
    assert.strictEqual(((await handleInvite(good, true, older.deps)).body as { reason?: string }).reason, "existing-account");
  });

  test("an email service failure still leaves the invitation saved, and says why", async () => {
    const { deps: d } = deps({ async emailInvitation() { return { error: { message: "Email rate limit exceeded" } }; } });
    assert.deepStrictEqual(await handleInvite(good, true, d), { status: 200, body: { invited: true, emailed: false, reason: "email-failed", detail: "Email rate limit exceeded" } });
  });

  test("only passes on a web address as the redirect", async () => {
    const { calls, deps: d } = deps();
    await handleInvite({ ...good, redirectTo: "javascript:alert(1)" }, true, d);
    await handleInvite({ ...good, redirectTo: 42 }, true, d);
    assert.ok(calls.filter((c) => c.startsWith("email")).every((c) => c.endsWith(" -")), calls.join(" | "));
  });
});
