"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  formatInviteCode,
  invitationMessage,
  ROLE_LABELS,
  Textarea,
  type ShopRole,
} from "@pos/shared";
import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { isTauri } from "@/lib/desktop";
import { siteUrl } from "@/lib/site-url";

export type InviteToShow = { code: string; role: ShopRole; label: string | null; expiresAt: string; created: boolean };

/** "in 23 hours", "in 40 minutes" or "expired". */
export function expiresIn(expiresAt: string, now = Date.now()): string {
  const minutes = Math.round((new Date(expiresAt).getTime() - now) / 60000);
  if (minutes <= 0) return "expired";
  if (minutes < 90) return `in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.round(minutes / 60);
  return `in ${hours} ${hours === 1 ? "hour" : "hours"}`;
}

/** Copies text, with the old select-and-copy command for browsers that refuse the clipboard. Resolves to whether it worked. */
export async function copyText(text: string, fallback?: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (!fallback) return false;
    fallback.focus();
    fallback.select();
    return document.execCommand("copy");
  }
}

/** Shows an invitation code big enough to read out, with a ready-made message to send along with it. */
export function InviteCodeDialog({ invite, shopName, onClose }: { invite: InviteToShow | null; shopName: string; onClose: () => void }) {
  const [copied, setCopied] = useState<"code" | "message" | null>(null);
  useEffect(() => { setCopied(null); }, [invite]);

  const message = invite ? invitationMessage({ shopName, role: invite.role, code: invite.code, siteUrl: siteUrl() }) : "";
  const links = !isTauri(); // the desktop window cannot open mail or browser links; copying works everywhere

  const copy = async (what: "code" | "message") => {
    if (!invite) return;
    const worked = await copyText(what === "code" ? formatInviteCode(invite.code) : message, document.getElementById("invite-message") as HTMLTextAreaElement | null);
    if (!worked) return;
    setCopied(what);
    window.setTimeout(() => setCopied(null), 2500);
  };

  return (
    <Dialog open={invite !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{invite?.created ? "Invitation code ready" : "Invitation code"}</DialogTitle>
          <DialogDescription>
            {invite
              ? `Give this code to ${invite.label ?? "the person"}. They type it in when they sign up and join ${shopName} as ${/^[aeiou]/i.test(ROLE_LABELS[invite.role]) ? "an" : "a"} ${ROLE_LABELS[invite.role].toLowerCase()}. It works once and expires ${expiresIn(invite.expiresAt)}.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 rounded-xl border bg-muted/40 p-4 text-center">
          <p className="select-all font-mono text-3xl font-extrabold tracking-[0.2em]" aria-label="Invitation code">
            {invite ? formatInviteCode(invite.code) : ""}
          </p>
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => void copy("code")}>
              {copied === "code" ? <Check /> : <Copy />}
              {copied === "code" ? "Copied" : "Copy code"}
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-semibold">Or send this message</p>
          <Textarea id="invite-message" readOnly rows={6} value={message} aria-label="Invitation message" onFocus={(event) => event.currentTarget.select()} />
        </div>

        <DialogFooter className="sm:flex-wrap">
          {invite && links && (
            <>
              <Button asChild variant="outline">
                <a href={`mailto:?subject=${encodeURIComponent(`Join ${shopName} on KT POS System`)}&body=${encodeURIComponent(message)}`}>
                  <Mail />
                  Email
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle />
                  WhatsApp
                </a>
              </Button>
            </>
          )}
          <Button type="button" onClick={() => void copy("message")}>
            {copied === "message" ? <Check /> : <Copy />}
            {copied === "message" ? "Copied" : "Copy message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
