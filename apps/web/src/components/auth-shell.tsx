import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@pos/shared";
import { BarChart3, PackageCheck, WifiOff } from "lucide-react";
import { ThemeToggle } from "./theme";

const points = [
  { icon: PackageCheck, title: "Stock that stays honest", text: "Every sale and delivery updates inventory the moment it happens." },
  { icon: WifiOff, title: "Keeps selling offline", text: "The desktop app queues sales and syncs when the connection returns." },
  { icon: BarChart3, title: "Numbers you can act on", text: "Revenue, profit, and payment mix without a spreadsheet." },
];

/** A decorative till receipt: static, always paper-white so it reads the same in both themes. */
function ReceiptArt() {
  const items: [string, string][] = [
    ["Bottled water ×2", "8.00"],
    ["Fresh bread", "12.50"],
    ["Shea butter", "35.00"],
  ];
  return (
    <div
      aria-hidden="true"
      className="w-[280px] -rotate-2 rounded-2xl bg-[#fdfcf8] p-5 text-[#14201a] shadow-lg"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-extrabold tracking-tight">Sale #1042</p>
        <span className="rounded-full bg-[#e0f3e7] px-2.5 py-0.5 text-[11px] font-bold text-[#0c7a43]">Paid · MoMo</span>
      </div>
      <ul className="mt-4 grid gap-2 border-t border-dashed border-[#d9d5c8] pt-4 text-[13px]">
        {items.map(([name, price]) => (
          <li key={name} className="flex justify-between">
            <span>{name}</span>
            <span className="tabular-nums">{price}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-baseline justify-between border-t border-dashed border-[#d9d5c8] pt-4">
        <span className="text-[13px] font-semibold text-[#5b675f]">Total</span>
        <span className="text-xl font-extrabold tracking-tight tabular-nums">55.50</span>
      </div>
    </div>
  );
}

/** `wide` gives multi-field forms (like onboarding) more room than the sign-in form needs. */
export function AuthShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside
        className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-white lg:flex"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 85% 0%, rgba(63,192,141,0.22), transparent 70%), radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)",
          backgroundSize: "auto, 24px 24px",
        }}
      >
        <Link href="/" aria-label="KT POS System home">
          <Logo tone="onDark" wordmark size={40} />
        </Link>

        <div className="relative">
          <h2 className="max-w-md text-[40px] font-extrabold leading-[1.1] tracking-tight">
            The counter, the stock room, and the books — in one calm workspace.
          </h2>
          <ul className="mt-9 grid max-w-md gap-5">
            {points.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/8 text-[#3fc08d]">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-bold">{title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-sidebar-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="pointer-events-none absolute -right-2 top-[42%] hidden 2xl:block">
            <ReceiptArt />
          </div>
        </div>

        <p className="text-xs text-sidebar-muted">© {new Date().getFullYear()} KT POS System · Built for everyday retail</p>
      </aside>

      <div className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="lg:invisible" aria-label="KT POS System home">
            <Logo wordmark size={32} />
          </Link>
          <ThemeToggle />
        </div>
        <main className="grid flex-1 place-items-center px-5 pb-12 pt-2 sm:px-8">
          <div className={wide ? "w-full max-w-[560px]" : "w-full max-w-[400px]"}>{children}</div>
        </main>
      </div>
    </div>
  );
}
