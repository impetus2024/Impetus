import type { ReactNode } from "react";
import { BrandMark } from "@/components/shell/brand-mark";

// Hand-drawn so the split-screen auth layout doesn't need an external image
// asset — a circle, a center pentagon, and five spokes reads as a football
// at a glance and stays crisp at any size.
function SoccerBallIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.25" />
      <polygon
        points="12,8.8 15.04,11.01 13.88,14.59 10.12,14.59 8.96,11.01"
        fill="currentColor"
      />
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round">
        <line x1="12" y1="8.8" x2="12" y2="3" />
        <line x1="15.04" y1="11.01" x2="20.56" y2="9.22" />
        <line x1="13.88" y1="14.59" x2="17.29" y2="19.28" />
        <line x1="10.12" y1="14.59" x2="6.71" y2="19.28" />
        <line x1="8.96" y1="11.01" x2="3.44" y2="9.22" />
      </g>
    </svg>
  );
}

// Shared chrome for every unauthenticated auth page (login, forgot-password,
// reset-password): a dark visual panel on the left, the actual form on the
// right. Each page supplies its own heading/copy/form as `children` — this
// only owns the split-screen frame so it isn't duplicated three times.
export function AuthShell({
  headline = ["Manage", "your club"],
  children,
}: {
  headline?: [string, string];
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background p-4 md:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-4xl shadow-elevated ring-1 ring-foreground/10 md:grid-cols-2">
        {/* Left: dark visual panel — always dark regardless of light/dark mode, like the reference. */}
        <div className="relative hidden flex-col items-center justify-center gap-12 overflow-hidden bg-[oklch(0.17_0.03_262)] p-10 text-white md:flex">
          <div className="relative mx-auto flex size-72 items-center justify-center">
            <div
              aria-hidden
              className="absolute size-72 rounded-full border border-white/10"
            />
            <div
              aria-hidden
              className="absolute size-52 rounded-full border border-white/10"
            />
            <h2 className="relative text-center font-heading text-5xl leading-[1.05] font-bold tracking-tight">
              {headline[0]}
              <br />
              {headline[1]}
            </h2>
          </div>

          <div className="flex justify-center">
            <SoccerBallIcon className="size-32 text-white/90" />
          </div>
        </div>

        {/* Right: form panel */}
        <div className="flex flex-col bg-card p-8 sm:p-12">
          <BrandMark />
          <div className="flex flex-1 flex-col justify-center py-10">
            <div className="mx-auto w-full max-w-sm">{children}</div>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Impetus
          </p>
        </div>
      </div>
    </div>
  );
}
