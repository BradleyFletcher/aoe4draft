import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join Draft",
  description:
    "Join an existing Age of Empires IV draft as a player or spectator.",
  openGraph: {
    title: "Join Draft | AOE4 Draft",
    description:
      "Join an existing Age of Empires IV draft as a player or spectator.",
  },
};

export default function SeedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
