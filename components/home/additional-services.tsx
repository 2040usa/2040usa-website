import { services } from "@/lib/homepage-data";
import { IconContainer } from "@/components/ui/icon-container";
import { SectionLabel } from "@/components/ui/section-label";

export function AdditionalServices() {
  return (
    <section id="services" className="rounded-control border border-border bg-panel p-5 shadow-[var(--card-shadow)] sm:p-6" aria-labelledby="services-heading">
      <SectionLabel>Additional services</SectionLabel>
      <h2 id="services-heading" className="mt-5 font-display text-3xl font-semibold leading-tight text-text-primary sm:text-4xl">Support for files and finished projects.</h2>
      <p className="mt-5 text-sm leading-6 text-text-muted">Potential project support is reviewed with the scope; availability is not implied by this preview.</p>
      <div className="mt-6 divide-y divide-border border-y border-border">
        {services.map(({ title, detail, icon: Icon }) => (
          <article key={title} className="grid grid-cols-[auto_1fr] gap-4 py-5">
            <IconContainer className="size-9"><Icon aria-hidden="true" size={17} strokeWidth={1.5} /></IconContainer>
            <div><h3 className="font-display text-xl font-semibold text-text-primary">{title}</h3><p className="mt-2 text-xs leading-5 text-text-muted">{detail}</p></div>
          </article>
        ))}
      </div>
      <p className="mt-4 text-xs text-text-muted">Scope and availability require confirmation.</p>
    </section>
  );
}
