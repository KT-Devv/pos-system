"use client";

import Link from "next/link";
import { Button, Card, EmptyState } from "@pos/shared";
import { ShoppingCart, WifiOff } from "lucide-react";

/** Shown in place of a screen that needs the server while the desktop app is offline. Selling still works. */
export function OfflineScreen({ title }: { title: string }) {
  return (
    <Card>
      <EmptyState
        icon={WifiOff}
        title={`${title} needs an internet connection`}
        description="You're offline. Sales still work and are saved on this computer, then sent when the connection returns. This screen opens again by itself once you're back online."
        action={<Button asChild><Link href="/sales"><ShoppingCart />Go to Sales</Link></Button>}
      />
    </Card>
  );
}
