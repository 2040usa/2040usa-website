import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Shirt } from "lucide-react";
import { IconContainer } from "@/components/ui/icon-container";

type PreviewKind = "gang-sheet" | "artwork" | "sizes" | "apparel";

function WorkflowPreview({ kind }: { kind: PreviewKind }) {
  if (kind === "gang-sheet") {
    return <div className="grid h-24 grid-cols-4 gap-1 bg-sheet p-2" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <span key={index} className={index % 3 === 0 ? "bg-registration-red" : index % 2 === 0 ? "bg-accent" : "bg-sheet-ink"} />)}</div>;
  }

  if (kind === "artwork") {
    return <div className="grid h-24 grid-cols-2 gap-px bg-border" aria-hidden="true"><span className="grid place-items-center bg-sheet font-display text-3xl text-registration-red">LA</span><span className="technical-grid grid place-items-center bg-raised font-display text-3xl text-accent">20</span></div>;
  }

  if (kind === "sizes") {
    return <div className="flex h-24 items-end justify-around border border-border bg-raised p-3" aria-hidden="true">{["8″", "11″", "15″", "22″"].map((size, index) => <span key={size} style={{ height: `${36 + index * 14}%` }} className="grid w-10 place-items-center border border-border bg-panel font-mono text-[0.55rem] text-text-muted">{size}</span>)}</div>;
  }

  return <div className="grid h-24 place-items-center border border-border bg-raised" aria-hidden="true"><Shirt size={58} strokeWidth={0.8} className="text-text-muted" /><span className="absolute font-display text-sm text-accent">2040</span></div>;
}

export function WorkflowCard({ index, title, description, meta, preview, icon: Icon }: { index: number; title: string; description: string; meta: string; preview: PreviewKind; icon: LucideIcon }) {
  return (
    <article className="group flex min-h-80 flex-col rounded-control border border-border bg-panel p-4 transition-colors hover:border-accent sm:p-5">
      <div className="flex items-start justify-between"><IconContainer className="size-9"><Icon aria-hidden="true" size={17} strokeWidth={1.5} /></IconContainer><span className="font-display text-2xl text-accent">{String(index + 1).padStart(2, "0")}</span></div>
      <h3 className="mt-6 min-h-14 font-display text-2xl uppercase leading-none text-text-primary">{title}</h3>
      <p className="mt-3 min-h-12 text-xs leading-5 text-text-muted">{description}</p>
      <div className="relative mt-4"><WorkflowPreview kind={preview} /></div>
      <a href="#experience" className="mt-4 inline-flex items-center justify-between rounded-control border border-border px-3 py-2.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.13em] text-text-primary hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><span>{meta}</span><ArrowUpRight aria-hidden="true" size={14} /></a>
    </article>
  );
}
