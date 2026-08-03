import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { OrderRoute } from "@/lib/order-draft/types";
import { IconContainer } from "@/components/ui/icon-container";
import { RouteVisual } from "@/components/order/route-visual";

export function WorkflowCard({ index, route, title, description, meta, icon: Icon }: { index: number; route: OrderRoute; title: string; description: string; meta: string; icon: LucideIcon }) {
  return (
    <article className="group flex min-h-80 flex-col rounded-control border border-border bg-panel p-4 transition-colors hover:border-accent sm:p-5">
      <div className="flex items-start justify-between"><IconContainer className="size-9"><Icon aria-hidden="true" size={17} strokeWidth={1.5} /></IconContainer><span className="font-display text-2xl text-accent">{String(index + 1).padStart(2, "0")}</span></div>
      <h3 className="mt-6 min-h-14 font-display text-2xl uppercase leading-none text-text-primary">{title}</h3>
      <p className="mt-3 min-h-12 text-xs leading-5 text-text-muted">{description}</p>
      <div className="relative mt-4"><RouteVisual route={route} compact /></div>
      <Link href={`/order/start?route=${route}`} aria-label={`Start with ${title}`} className="mt-4 inline-flex items-center justify-between rounded-control border border-border px-3 py-2.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.13em] text-text-primary hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><span>{meta}</span><ArrowUpRight aria-hidden="true" size={14} /></Link>
    </article>
  );
}
