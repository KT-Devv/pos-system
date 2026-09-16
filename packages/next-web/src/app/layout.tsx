import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "POS System",
  description: "Fast inventory and point-of-sale management",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
