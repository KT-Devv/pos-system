import { notFound } from "next/navigation";
import SectionClient from "./SectionClient";
const sections = ["sales", "products", "inventory", "customers", "reports", "settings"] as const;

export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section as (typeof sections)[number])) notFound();

  return <SectionClient section={section as (typeof sections)[number]} />;
}
