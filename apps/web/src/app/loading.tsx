import { Logo } from "@pos/shared";

export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <div className="grid justify-items-center gap-3 text-sm text-muted-foreground">
        <Logo size={44} />
        Loading…
      </div>
    </main>
  );
}
