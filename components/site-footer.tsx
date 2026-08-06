import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="bg-primary-action pt-16 text-primary-action-foreground" aria-label="Site footer">
      <div className="page-shell grid gap-12 border-b border-white/20 pb-16 lg:grid-cols-[1.2fr_0.8fr]">
        <div><p className="font-display text-5xl font-semibold leading-tight sm:text-7xl">Ready when<br /><span className="text-white">your art is.</span></p><Link href="/order/start" className="mt-8 inline-flex items-center gap-2 border-b border-white/70 pb-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Start a Print <ArrowUpRight aria-hidden="true" size={16} /></Link></div>
        <div className="grid gap-8 sm:grid-cols-2"><div><p className="footer-label">Navigate</p>{[["Options", "#options"], ["Process", "#process"], ["Quality", "#quality"], ["Services", "#services"]].map(([label, href]) => <Link key={href} href={href} className="mt-3 block text-sm text-white/75 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">{label}</Link>)}</div><div><p className="footer-label">Production area</p><p className="mt-4 flex gap-2 text-sm leading-6 text-white/75"><MapPin aria-hidden="true" size={17} className="mt-1 shrink-0 text-white" />Downtown Los Angeles<br />Pickup details provided with confirmed work.</p></div></div>
      </div>
      <div className="page-shell flex flex-col gap-3 py-6 text-xs text-white/65 sm:flex-row sm:items-center sm:justify-between"><p>© 2040 USA / DTF Production</p><p>Downtown Los Angeles</p></div>
    </footer>
  );
}
