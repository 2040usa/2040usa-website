import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="bg-panel pt-16" aria-label="Site footer">
      <div className="page-shell grid gap-12 border-b border-border pb-16 lg:grid-cols-[1.2fr_0.8fr]">
        <div><p className="font-display text-5xl uppercase leading-none text-text-primary sm:text-7xl">Ready when<br /><span className="text-accent">your art is.</span></p><Link href="/order/start" className="mt-8 inline-flex items-center gap-2 border-b border-accent pb-2 font-mono text-xs font-bold uppercase tracking-widest text-text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">Start a Print <ArrowUpRight aria-hidden="true" size={16} /></Link></div>
        <div className="grid gap-8 sm:grid-cols-2"><div><p className="footer-label">Navigate</p>{[["Options", "#options"], ["Process", "#process"], ["Quality", "#quality"], ["Services", "#services"]].map(([label, href]) => <Link key={href} href={href} className="mt-3 block text-sm text-text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">{label}</Link>)}</div><div><p className="footer-label">Production area</p><p className="mt-4 flex gap-2 text-sm leading-6 text-text-muted"><MapPin aria-hidden="true" size={17} className="mt-1 shrink-0 text-accent" />Downtown Los Angeles<br />Pickup details provided with confirmed work.</p></div></div>
      </div>
      <div className="page-shell flex flex-col gap-3 py-6 font-mono text-[0.58rem] uppercase tracking-widest text-text-muted sm:flex-row sm:items-center sm:justify-between"><p>© 2040 USA / DTF Production</p><p>Built for real production, not a storefront theme.</p></div>
    </footer>
  );
}
