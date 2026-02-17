import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Draft",
  description:
    "Configure teams, civilization and map pools, and draft order for your Age of Empires IV match.",
  openGraph: {
    title: "Create Draft | AOE4 Draft",
    description:
      "Configure teams, civilization and map pools, and draft order for your Age of Empires IV match.",
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
