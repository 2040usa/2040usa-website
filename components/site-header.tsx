import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MobileMenu } from "@/components/mobile-menu";

const navItems = [
  { label: "Options", href: "#options" },
  { label: "Process", href: "#process" },
  { label: "Quality", href: "#quality" },
  { label: "Services", href: "#services" },
] as const;

export function SiteHeader() {
  return (
    <header className="relative z-50 border-b border-border bg-background">
      <div className="page-shell flex h-16 items-center justify-between gap-6 sm:h-18">
        <Link href="#top" className="group flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" aria-label="2040 USA home">
          <span className="font-display text-2xl uppercase tracking-[-0.03em] text-text-primary sm:text-3xl">2040</span>
          <span className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-accent">USA</span>
        </Link>
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden lg:block"><Button href="/order/start">Start a Print</Button></div>
        <MobileMenu items={navItems} />
      </div>
    </header>
  );
}
