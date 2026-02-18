import {
  ArrowRight,
  Users,
  Shield,
  Crown,
  Map,
  Dice5,
  Swords,
  Settings2,
} from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <div className="max-w-3xl mx-auto px-4 pt-12 md:pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 ring-1 ring-primary/20 text-primary text-[11px] font-semibold uppercase tracking-widest mb-6">
          <Swords className="w-3.5 h-3.5" />
          Age of Empires IV
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4 bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
          Draft Tool
        </h1>
        <p className="text-muted-foreground text-base md:text-lg max-w-lg mx-auto mb-10 leading-relaxed">
          Run competitive civ &amp; map drafts for your tournament matches. Ban,
          pick, and let the battle begin.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto mb-16">
          <Link href="/admin" className="flex-1">
            <button className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] transition-all">
              Create Draft
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <Link href="/seed" className="flex-1">
            <button className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-card ring-1 ring-border font-semibold text-sm hover:ring-primary/40 hover:scale-[1.02] transition-all">
              <Users className="w-4 h-4 text-muted-foreground" />
              Join Draft
            </button>
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <FeatureCard
            icon={<Shield className="w-5 h-5 text-red-400" />}
            title="Civ & Map Bans"
            description="Global or per-team bans. Remove civilizations and maps from the pool before picks begin."
          />
          <FeatureCard
            icon={<Crown className="w-5 h-5 text-green-400" />}
            title="Turn-Based Picks"
            description="Alternating pick order with per-player assignments. Each player selects their own civilization."
          />
          <FeatureCard
            icon={<Map className="w-5 h-5 text-blue-400" />}
            title="Map Drafting"
            description="Teams ban and pick maps from a configurable pool. Supports BO1 and BO3 formats."
          />
          <FeatureCard
            icon={<Dice5 className="w-5 h-5 text-yellow-400" />}
            title="Random Decider Map"
            description="Odd map picks are auto-randomised with a suspenseful reveal animation."
          />
          <FeatureCard
            icon={<Settings2 className="w-5 h-5 text-purple-400" />}
            title="Fully Configurable"
            description="Custom civ and map pools, preset formats, editable draft order, and team names."
          />
          <FeatureCard
            icon={<Swords className="w-5 h-5 text-orange-400" />}
            title="1v1 to 4v4"
            description="Supports all team sizes with scaled ban counts and per-player civ picks."
          />
        </div>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-card/80 backdrop-blur-sm ring-1 ring-border/50 hover:ring-border transition-colors">
      <div className="flex items-center gap-2.5 mb-2">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground/70 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
