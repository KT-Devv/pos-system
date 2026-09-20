"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, Badge, Button, cn, Logo, ROLE_LABELS, type ShopRole } from "@pos/shared";
import { LogOut } from "lucide-react";
import { HOME_NAV, MOBILE_NAV, NAV_GROUPS, SECTIONS, type Section } from "@/features/sections";
import { OnlineStatus } from "./online-status";
import { ThemeToggle } from "./theme";

export type ShellUser = { id: string; name: string; role: ShopRole };

function SidebarLink({ item, active }: { item: Section | "home"; active: boolean }) {
  const { title, icon: Icon } = item === "home" ? HOME_NAV : SECTIONS[item];
  return (
    <Link
      href={item === "home" ? HOME_NAV.href : `/${item}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      {active && <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-sidebar-marker" />}
      <Icon className={cn("h-[18px] w-[18px]", active ? "text-[#3fc08d]" : "text-sidebar-muted")} />
      {title}
    </Link>
  );
}

export function AppShell({
  section,
  user,
  shopName,
  onSignOut,
  children,
}: {
  section: Section | "home";
  user: ShellUser;
  shopName: string;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col bg-sidebar px-3 py-5 md:flex">
        <Link href="/" className="mb-5 block px-2" aria-label="KTDEVV POS home">
          <Logo tone="onDark" wordmark size={34} />
        </Link>

        <div className="mx-2 mb-6 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-muted">Your shop</p>
          <p className="truncate text-sm font-semibold text-white" title={shopName}>{shopName}</p>
        </div>

        <nav className="grid gap-5" aria-label="Main">
          <SidebarLink item="home" active={section === "home"} />
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="grid gap-1">
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-muted">
                {group.label}
              </p>
              {group.items.map((item) => (
                <SidebarLink key={item} item={item} active={item === section} />
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-auto grid gap-3">
          <SidebarLink item="settings" active={section === "settings"} />
          <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-2.5">
            <Avatar name={user.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">{user.name}</p>
              <p className="text-[11px] font-medium text-sidebar-muted">{ROLE_LABELS[user.role]}</p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="grid h-8 w-8 place-items-center rounded-md text-sidebar-muted hover:bg-sidebar-accent hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur md:h-16 md:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 md:hidden" aria-label="KTDEVV POS home">
            <Logo size={30} />
            <span className="truncate text-[15px] font-extrabold tracking-tight">{shopName}</span>
          </Link>
          <p className="hidden text-sm font-medium text-muted-foreground md:block">{today}</p>
          <div className="flex items-center gap-1.5">
            <OnlineStatus />
            <Badge variant="secondary" className="hidden lg:inline-flex">
              {ROLE_LABELS[user.role]}
            </Badge>
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="md:hidden" onClick={onSignOut} aria-label="Sign out">
              <LogOut />
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-10 md:pt-8">
          {children}
        </main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {MOBILE_NAV.map((item) => {
          const { title, icon: Icon } = SECTIONS[item];
          const active = item === section;
          return (
            <Link
              key={item}
              href={`/${item}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[10px] font-semibold",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className={cn("grid h-7 w-12 place-items-center rounded-full", active && "bg-accent")}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
              {title}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
