"use client";

import Link from "next/link";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Button, canManageShop, Card, CardContent, CardDescription, CardHeader, CardTitle, configureMoney, Logo, type ShopRole } from "@pos/shared";
import { Onboarding } from "@/features/onboarding";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { isDeadSessionError } from "@/lib/supabase/auth-errors";

type Client = ReturnType<typeof createSupabaseBrowserClient>;

/** A shop's settings, as stored on the `shops` row. */
export type Shop = {
  id: string;
  name: string;
  currency: string;
  country: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  low_stock_threshold: number;
  loyalty_enabled: boolean;
  loyalty_spend_per_point: number;
  owner_id: string;
};

export type WorkspaceUser = { id: string; name: string; email: string | null };

export type PendingInvite = {
  invite_id: string;
  shop_id: string;
  shop_name: string;
  role: ShopRole;
  invited_by_name: string | null;
  expires_at: string;
};

export type Workspace = {
  supabase: Client;
  user: WorkspaceUser;
  shop: Shop;
  role: ShopRole;
  /** Owner or admin: may change the catalog, shop settings and team. */
  isAdmin: boolean;
  isOwner: boolean;
  /** Reload the shop (after settings change) and re-apply its currency. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

type State =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "needs-shop"; user: WorkspaceUser; invites: PendingInvite[] }
  | { status: "ready"; user: WorkspaceUser; shop: Shop; role: ShopRole }
  | { status: "error"; message: string };

const WorkspaceContext = createContext<Workspace | null>(null);

export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("useWorkspace must be used inside <WorkspaceGate>");
  return workspace;
}

/** Explains the one failure an operator can actually fix themselves. */
function describeLoadError(error: { code?: string; message: string; hint?: string }) {
  if (error.code === "PGRST205" || error.code === "42P01" || /schema cache|does not exist/i.test(error.message)) {
    return "This database hasn't been upgraded for shops yet. Run database/migrations/004_multi_tenant_shops.sql in the Supabase SQL editor, then reload.";
  }
  if (error.code === "42501" || /permission denied/i.test(error.message)) {
    return [
      "This database is missing table privileges for signed-in users. Run database/migrations/005_grant_authenticated.sql in the Supabase SQL editor, then reload.",
      error.hint,
    ].filter(Boolean).join(" ");
  }
  return error.message;
}

async function loadWorkspace(supabase: Client): Promise<State> {
  const { data, error } = await supabase.auth.getUser();
  if (error && isDeadSessionError(error)) {
    await supabase.auth.signOut({ scope: "local" });
    return { status: "signed-out" };
  }
  if (error && error.name !== "AuthSessionMissingError") return { status: "error", message: error.message };
  if (!data.user) return { status: "signed-out" };

  const authUser = data.user;
  const [profile, membership] = await Promise.all([
    supabase.from("profiles").select("name,email").eq("id", authUser.id).maybeSingle(),
    supabase.from("shop_members").select("role, shops(*)").eq("user_id", authUser.id).maybeSingle(),
  ]);
  if (membership.error) return { status: "error", message: describeLoadError(membership.error) };

  const user: WorkspaceUser = {
    id: authUser.id,
    name: profile.data?.name ?? authUser.email ?? "User",
    email: authUser.email ?? null,
  };

  const shop = (membership.data as unknown as { role: ShopRole; shops: Shop | null } | null)?.shops;
  if (membership.data && shop) {
    // Every screen formats money through this, so it must be set before any of them render.
    configureMoney({ currency: shop.currency });
    return { status: "ready", user, shop, role: (membership.data as unknown as { role: ShopRole }).role };
  }

  const invites = await supabase.rpc("my_invites");
  return { status: "needs-shop", user, invites: invites.error ? [] : ((invites.data ?? []) as PendingInvite[]) };
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return <main className="grid min-h-screen place-items-center px-6 py-12">{children}</main>;
}

/**
 * Resolves who is signed in and which shop they work in, and only renders `children` once both are
 * known. Signed-out visitors are sent to /login unless `signedOut` supplies a public page instead.
 */
export function WorkspaceGate({ children, signedOut }: { children: ReactNode; signedOut?: ReactNode }) {
  const configured = isSupabaseConfigured();
  const supabase = useMemo(
    () => (typeof window === "undefined" || !configured ? null : createSupabaseBrowserClient()),
    [configured],
  );
  const [state, setState] = useState<State>({ status: "loading" });

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setState(await loadWorkspace(supabase));
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    loadWorkspace(supabase)
      .then((next) => { if (active) setState(next); })
      .catch((cause) => { if (active) setState({ status: "error", message: cause instanceof Error ? cause.message : String(cause) }); });
    return () => { active = false; };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    window.location.href = "/";
  }, [supabase]);

  const redirecting = state.status === "signed-out" && !signedOut;
  useEffect(() => {
    if (redirecting) window.location.replace("/login");
  }, [redirecting]);

  const workspace = useMemo<Workspace | null>(() => {
    if (!supabase || state.status !== "ready") return null;
    return {
      supabase,
      user: state.user,
      shop: state.shop,
      role: state.role,
      isAdmin: canManageShop(state.role),
      isOwner: state.role === "owner",
      refresh,
      signOut,
    };
  }, [supabase, state, refresh, signOut]);

  if (!configured) {
    if (signedOut) return <>{signedOut}</>;
    return (
      <CenteredMessage>
        <Card className="w-full max-w-lg">
          <CardHeader>
            <Logo size={40} className="mb-3" />
            <CardTitle className="text-xl">Connect your workspace</CardTitle>
            <CardDescription>
              Add your Supabase project URL and anonymous key to <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">apps/web/.env.local</code>,
              then restart the development server.
            </CardDescription>
          </CardHeader>
        </Card>
      </CenteredMessage>
    );
  }

  if (state.status === "signed-out" && signedOut) return <>{signedOut}</>;

  if (state.status === "error") {
    return (
      <CenteredMessage>
        <Card className="w-full max-w-md">
          <CardHeader>
            <Logo size={40} className="mb-3" />
            <CardTitle className="text-xl">Couldn&apos;t open your workspace</CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => window.location.reload()}>Try again</Button>
            <Button asChild variant="outline"><Link href="/login">Back to sign in</Link></Button>
          </CardContent>
        </Card>
      </CenteredMessage>
    );
  }

  if (state.status === "needs-shop" && supabase) {
    return <Onboarding supabase={supabase} user={state.user} invites={state.invites} onDone={refresh} onSignOut={signOut} />;
  }

  if (state.status === "ready" && workspace) {
    return <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>;
  }

  return (
    <CenteredMessage>
      <div className="grid justify-items-center gap-3 text-sm text-muted-foreground">
        <Logo size={44} />
        Loading workspace…
      </div>
    </CenteredMessage>
  );
}
