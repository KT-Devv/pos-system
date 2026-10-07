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
  invitationMessage,
  Textarea,
  type ShopRole,
} from "@pos/shared";
import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { isTauri } from "@/lib/desktop";
import { siteUrl } from "@/lib/site-url";

/** Why the invitation is being shown for the person to pass on themselves. */
export type ShareReason = "no-email-service" | "existing-account" | "email-failed" | "again";

export type ShareInvite = { email: string; role: ShopRole; reason: ShareReason; detail?: string };

function explanation(invite: ShareInvite): string {
  switch (invite.reason) {
    case "no-email-service":
      return "The invitation is saved, but invitation emails aren't switched on for your shop's server yet, so send them the message below yourself.";
    case "existing-account":
      return `The invitation is saved. ${invite.email} already has an account, so there is nothing to sign up for: they sign in with that email and the invitation is waiting for them.`;
    case "email-failed":
      return `The invitation is saved, but the email couldn't be sent${invite.detail ? ` (${invite.detail})` : ""}. Send them the message below yourself.`;
    case "again":
      return "Send this invitation again, or pass it on another way.";
  }
}

/** Shows the invitation as a ready-to-send message: copy it, or open it in email or WhatsApp. */
export function InviteShareDialog({ invite, shopName, onClose }: { invite: ShareInvite | null; shopName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { setCopied(false); }, [invite]);

  const message = invite ? invitationMessage({ shopName, role: invite.role, email: invite.email, siteUrl: siteUrl() }) : "";
  const links = !isTauri(); // the desktop window cannot open mail or browser links; copying works everywhere

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // No clipboard access (an older browser, or permission refused): select the text and use the old copy command.
      const box = document.getElementById("invite-message") as HTMLTextAreaElement | null;
      box?.focus();
      box?.select();
      if (document.execCommand("copy")) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      }
    }
  };

  return (
    <Dialog open={invite !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send the invitation</DialogTitle>
          <DialogDescription>{invite ? explanation(invite) : ""}</DialogDescription>
        </DialogHeader>
        <Textarea id="invite-message" readOnly rows={5} value={message} aria-label="Invitation message" onFocus={(event) => event.currentTarget.select()} />
        <DialogFooter className="sm:flex-wrap">
          {invite && links && (
            <>
              <Button asChild variant="outline">
                <a href={`mailto:${invite.email}?subject=${encodeURIComponent(`Join ${shopName} on KT POS System`)}&body=${encodeURIComponent(message)}`}>
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
          <Button type="button" onClick={() => void copy()}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
