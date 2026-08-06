import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { OrderRoute } from "@/lib/order-draft/types";
import { IconContainer } from "@/components/ui/icon-container";
import { RouteVisual } from "@/components/order/route-visual";

export function WorkflowCard({ index, route, title, description, meta, icon: Icon }: { index: number; route: OrderRoute; title: string; description: string; meta: string; icon: LucideIcon }) {
  return (
    <article className="group flex min-h-80 flex-col rounded-control border border-border bg-panel p-4 shadow-[var(--card-shadow)] transition-colors hover:border-border-strong sm:p-5">
      <div className="flex items-start justify-between"><IconContainer className="size-9"><Icon aria-hidden="true" size={17} strokeWidth={1.5} /></IconContainer><span className="text-sm font-semibold text-text-muted">{String(index + 1).padStart(2, "0")}</span></div>
      <h3 className="mt-6 min-h-14 font-display text-2xl font-semibold leading-tight text-text-primary">{title}</h3>
      <p className="mt-3 min-h-12 text-xs leading-5 text-text-muted">{description}</p>
      <div className="relative mt-4"><RouteVisual route={route} compact /></div>
      <Link href={`/order/start?route=${route}`} aria-label={`Start with ${title}`} className="mt-4 inline-flex min-h-11 items-center justify-between rounded-control border border-border-strong px-3 py-2.5 text-xs font-semibold text-text-primary hover:border-primary-action hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"><span>{meta}</span><ArrowUpRight aria-hidden="true" size={14} /></Link>
    </article>
  );
}
