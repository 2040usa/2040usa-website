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
    <header className="relative z-50 border-b border-border bg-panel">
      <div className="page-shell flex h-16 items-center justify-between gap-6 sm:h-18">
        <Link href="#top" className="group flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring" aria-label="2040 USA home">
          <span className="font-display text-2xl font-bold tracking-[-0.03em] text-text-primary sm:text-3xl">2040</span>
          <span className="text-xs font-semibold tracking-[0.08em] text-primary-action">USA</span>
        </Link>
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-medium text-text-secondary transition-colors hover:text-primary-action focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring">
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
