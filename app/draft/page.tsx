import type { Metadata } from "next";
import { readDraft, isValidSeed } from "@/lib/storage";
import DraftPage from "./draft-client";

type Props = {
  searchParams: Promise<{ seed?: string; role?: string; config?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const seed = params.seed;

  if (!seed || !isValidSeed(seed)) {
    return {
      title: "Draft",
      description: "Age of Empires IV Tournament Draft",
    };
  }

  const data = await readDraft(seed);
  const config = data?.state?.config;
  const draftName = config?.name || "Draft";
  const teamSize = config?.teamSize;
  const team1 = config?.team1Name || "Team 1";
  const team2 = config?.team2Name || "Team 2";

  const description = teamSize
    ? `${draftName} — ${team1} vs ${team2} (${teamSize}v${teamSize})`
    : `${draftName} — Age of Empires IV Tournament Draft`;

  return {
    title: draftName,
    description,
    openGraph: {
      title: `${draftName} | AOE4 Draft`,
      description,
    },
    twitter: {
      card: "summary",
      title: `${draftName} | AOE4 Draft`,
      description,
    },
  };
}

export default function Page() {
  return <DraftPage />;
}
