"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  canRemoveMember,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  formatInviteCode,
  Input,
  invitableRoles,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type ShopRole,
} from "@pos/shared";
import { Copy, KeyRound, Share2, Trash2, UserMinus, Users } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { type Feedback, Field, fail, MenuSelect } from "./common";
import { copyText, expiresIn, InviteCodeDialog, type InviteToShow } from "./invite-code-dialog";

type Member = { user_id: string; role: ShopRole; created_at: string; profiles: { name: string; email: string | null } | null };
type Invite = { id: string; code: string; label: string | null; role: ShopRole; created_at: string; expires_at: string; used_at: string | null };

export function Team({ onError, onNotice }: Feedback) {
  const { supabase, shop, user, role, isOwner } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [label, setLabel] = useState("");
  const [inviteRole, setInviteRole] = useState<ShopRole>("cashier");
  const [sending, setSending] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [sharing, setSharing] = useState<InviteToShow | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const roles = invitableRoles(role);

  const load = useCallback(async () => {
    const [memberRes, inviteRes] = await Promise.all([
      supabase.from("shop_members").select("user_id, role, created_at, profiles(name, email)").eq("shop_id", shop.id).order("created_at"),
      supabase.from("shop_invites").select("id, code, label, role, created_at, expires_at, used_at").eq("shop_id", shop.id).order("created_at", { ascending: false }),
    ]);
    if (memberRes.error) fail(onError, memberRes.error); else setMembers((memberRes.data ?? []) as unknown as Member[]);
    if (inviteRes.error) fail(onError, inviteRes.error); else setInvites((inviteRes.data ?? []) as Invite[]);
    setLoaded(true);
  }, [supabase, shop.id, onError]);

  useEffect(() => { void load(); }, [load]);

  const createInvite = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    const { data, error } = await supabase.rpc("create_invite", { p_shop_id: shop.id, p_role: inviteRole, p_label: label.trim() || null });
    setSending(false);
    if (error) { fail(onError, error); return; }
    const made = data as { code: string; role: ShopRole; label: string | null; expires_at: string };
    setLabel("");
    setSharing({ code: made.code, role: made.role, label: made.label, expiresAt: made.expires_at, created: true });
    await load();
  };

  const copyCode = async (invitation: Invite) => {
    if (!(await copyText(formatInviteCode(invitation.code)))) { onError("Couldn't copy. Open the invitation and copy the code from there."); return; }
    setCopiedId(invitation.id);
    window.setTimeout(() => setCopiedId((current) => (current === invitation.id ? null : current)), 2000);
  };

  const changeRole = async (member: Member, next: ShopRole) => {
    const { error } = await supabase.rpc("set_member_role", { p_shop_id: shop.id, p_user_id: member.user_id, p_role: next });
    if (error) { fail(onError, error); return; }
    onNotice(`${member.profiles?.name ?? "Member"} is now ${ROLE_LABELS[next].toLowerCase()}.`);
    await load();
  };

  const confirmRemove = async () => {
    if (!removing) return;
    const target = removing;
    setRemoving(null);
    const { error } = await supabase.rpc("remove_member", { p_shop_id: shop.id, p_user_id: target.user_id });
    if (error) { fail(onError, error); return; }
    onNotice(`${target.profiles?.name ?? "Member"} was removed from the team.`);
    await load();
  };

  const revoke = async (invitation: Invite) => {
    const { error } = await supabase.rpc("revoke_invite", { p_invite_id: invitation.id });
    if (error) { fail(onError, error); return; }
    onNotice(`Invitation code ${formatInviteCode(invitation.code)} cancelled.`);
    await load();
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Invite someone</CardTitle>
          <CardDescription>
            Create an invitation code for {shop.name} and give it to the person. They type it in when they sign up and join straight away. A code works once and expires after 24 hours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createInvite} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
            <Field label="Who is it for? (optional)" htmlFor="invite-label">
              <Input id="invite-label" maxLength={60} placeholder="e.g. Kofi, evening cashier" value={label} onChange={(event) => setLabel(event.target.value)} />
            </Field>
            <Field label="Role">
              <MenuSelect
                value={inviteRole}
                onValueChange={(value) => setInviteRole(value as ShopRole)}
                options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
              />
            </Field>
            <Button type="submit" disabled={sending}>
              <KeyRound />
              {sending ? "Creating…" : "Create code"}
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            {ROLE_LABELS[inviteRole]}: {ROLE_DESCRIPTIONS[inviteRole]}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>{members.length} {members.length === 1 ? "person" : "people"} in {shop.name}.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {members.length > 0 ? (
            <ul className="divide-y border-t">
              {members.map((member) => {
                const name = member.profiles?.name ?? "Unknown";
                const isYou = member.user_id === user.id;
                const canEditRole = isOwner && member.role !== "owner" && !isYou;
                return (
                  <li key={member.user_id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <Avatar name={name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {name}
                        {isYou && <span className="ml-2 text-xs font-medium text-muted-foreground">You</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{member.profiles?.email ?? "No email on file"}</p>
                    </div>
                    {canEditRole ? (
                      <div className="w-36">
                        <MenuSelect
                          value={member.role}
                          onValueChange={(value) => void changeRole(member, value as ShopRole)}
                          options={(["admin", "cashier"] as ShopRole[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
                        />
                      </div>
                    ) : (
                      <Badge variant={member.role === "owner" ? "default" : "secondary"}>{ROLE_LABELS[member.role]}</Badge>
                    )}
                    {!isYou && canRemoveMember(role, member.role) ? (
                      <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${name}`} title="Remove" onClick={() => setRemoving(member)}>
                        <UserMinus />
                      </Button>
                    ) : (
                      <span className="w-8" />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={Users} title={loaded ? "No team members yet" : "Loading team…"} />
          )}
        </CardContent>
      </Card>

      {invites.some((invitation) => !invitation.used_at) && (
        <Card>
          <CardHeader>
            <CardTitle>Invitation codes</CardTitle>
            <CardDescription>Codes that haven&apos;t been used yet. Each works once.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <ul className="divide-y border-t">
              {invites.filter((invitation) => !invitation.used_at).map((invitation) => {
                const left = expiresIn(invitation.expires_at);
                const expired = left === "expired";
                return (
                  <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className={expired ? "font-mono text-lg font-bold tracking-widest text-muted-foreground line-through" : "font-mono text-lg font-bold tracking-widest"}>
                        {formatInviteCode(invitation.code)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {invitation.label ? `${invitation.label} · ` : ""}{expired ? "Expired" : `Expires ${left}`}
                      </p>
                    </div>
                    <Badge variant="secondary">{ROLE_LABELS[invitation.role]}</Badge>
                    {!expired && (
                      <>
                        <Button variant="ghost" size="icon-sm" aria-label={`Copy invitation code ${formatInviteCode(invitation.code)}`} title="Copy the code" onClick={() => void copyCode(invitation)}>
                          {copiedId === invitation.id ? <span className="text-xs font-semibold text-success">Copied</span> : <Copy />}
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Share invitation code ${formatInviteCode(invitation.code)}`} title="Show the message to send" onClick={() => setSharing({ code: invitation.code, role: invitation.role, label: invitation.label, expiresAt: invitation.expires_at, created: false })}>
                          <Share2 />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Cancel invitation code ${formatInviteCode(invitation.code)}`} title={expired ? "Remove" : "Cancel this code"} onClick={() => void revoke(invitation)}>
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <InviteCodeDialog invite={sharing} shopName={shop.name} onClose={() => setSharing(null)} />

      <Dialog open={Boolean(removing)} onOpenChange={(open) => { if (!open) setRemoving(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove {removing?.profiles?.name ?? "this person"}?</DialogTitle>
            <DialogDescription>
              They will lose access to {shop.name} immediately. Their past sales stay in your records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoving(null)}>Keep on team</Button>
            <Button type="button" variant="destructive" onClick={() => void confirmRemove()}>
              <UserMinus />
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
