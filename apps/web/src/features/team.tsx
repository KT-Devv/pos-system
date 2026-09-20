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
  formatDate,
  Input,
  invitableRoles,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type ShopRole,
} from "@pos/shared";
import { MailPlus, Trash2, UserMinus, Users } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { type Feedback, Field, fail, MenuSelect } from "./common";

type Member = { user_id: string; role: ShopRole; created_at: string; profiles: { name: string; email: string | null } | null };
type Invite = { id: string; email: string; role: ShopRole; created_at: string; expires_at: string };

export function Team({ onError, onNotice }: Feedback) {
  const { supabase, shop, user, role, isOwner } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ShopRole>("cashier");
  const [sending, setSending] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);

  const roles = invitableRoles(role);

  const load = useCallback(async () => {
    const [memberRes, inviteRes] = await Promise.all([
      supabase.from("shop_members").select("user_id, role, created_at, profiles(name, email)").eq("shop_id", shop.id).order("created_at"),
      supabase.from("shop_invites").select("id, email, role, created_at, expires_at").eq("shop_id", shop.id).order("created_at", { ascending: false }),
    ]);
    if (memberRes.error) fail(onError, memberRes.error); else setMembers((memberRes.data ?? []) as unknown as Member[]);
    if (inviteRes.error) fail(onError, inviteRes.error); else setInvites((inviteRes.data ?? []) as Invite[]);
    setLoaded(true);
  }, [supabase, shop.id, onError]);

  useEffect(() => { void load(); }, [load]);

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!address) { onError("Enter an email address."); return; }
    setSending(true);
    const { error } = await supabase.rpc("invite_member", { p_shop_id: shop.id, p_email: address, p_role: inviteRole });
    setSending(false);
    if (error) { fail(onError, error); return; }
    setEmail("");
    onNotice(`Invitation saved. Ask ${address} to sign up or sign in with that email to join ${shop.name}.`);
    await load();
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
    onNotice(`Invitation for ${invitation.email} cancelled.`);
    await load();
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Invite someone</CardTitle>
          <CardDescription>
            Add staff to {shop.name}. They join by signing up (or signing in) with the email address you enter here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={invite} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
            <Field label="Email address" htmlFor="invite-email">
              <Input id="invite-email" type="email" required placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Field label="Role">
              <MenuSelect
                value={inviteRole}
                onValueChange={(value) => setInviteRole(value as ShopRole)}
                options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
              />
            </Field>
            <Button type="submit" disabled={sending}>
              <MailPlus />
              {sending ? "Saving…" : "Invite"}
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

      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>People who haven&apos;t joined yet.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <ul className="divide-y border-t">
              {invites.map((invitation) => (
                <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{invitation.email}</p>
                    <p className="text-xs text-muted-foreground">Expires {formatDate(invitation.expires_at)}</p>
                  </div>
                  <Badge variant="secondary">{ROLE_LABELS[invitation.role]}</Badge>
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Cancel invitation for ${invitation.email}`} title="Cancel invitation" onClick={() => void revoke(invitation)}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

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
