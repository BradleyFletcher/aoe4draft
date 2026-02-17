import { Users, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-xl mx-auto">
        <div className="pt-12 md:pt-20 pb-12 md:pb-16">
          <p className="text-muted-foreground text-sm mb-10 max-w-sm">
            Set up civilization and map bans &amp; picks for your Age of Empires
            IV tournament matches.
          </p>

          <div className="space-y-3">
            <Link href="/admin" className="block">
              <button className="w-full flex items-center justify-between p-4 rounded-xl bg-card ring-1 ring-border hover:ring-primary/40 transition-all group">
                <div className="text-left">
                  <p className="text-sm font-semibold mb-0.5">
                    Create New Draft
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Configure teams, pools, and draft order
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </button>
            </Link>
            <Link href="/seed" className="block">
              <button className="w-full flex items-center justify-between p-4 rounded-xl bg-card ring-1 ring-border hover:ring-primary/40 transition-all group">
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <div className="text-left">
                    <p className="text-sm font-semibold mb-0.5">
                      Join Existing Draft
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Paste a link to enter as a player or spectator
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </button>
            </Link>
          </div>

          <p className="text-[11px] text-muted-foreground tracking-wide uppercase mt-10">
            Supports 1v1 &middot; 2v2 &middot; 3v3 &middot; 4v4
          </p>
        </div>
      </div>
    </main>
  );
}
