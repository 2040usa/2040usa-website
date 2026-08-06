import { ArtworkDropzonePreview } from "@/components/home/artwork-dropzone-preview";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";

export function Hero() {
  return (
    <section id="top" className="border-b border-border pb-14 pt-12 sm:pb-18 sm:pt-16 lg:pb-20 lg:pt-20" aria-labelledby="hero-heading">
      <div className="page-shell grid items-center gap-10 lg:grid-cols-[0.84fr_1.16fr] lg:gap-12">
        <Reveal>
          <SectionLabel>DTF printing in Downtown Los Angeles</SectionLabel>
          <h1 id="hero-heading" className="mt-6 max-w-4xl font-display text-[clamp(3.1rem,6.8vw,6.5rem)] font-semibold leading-[0.94] tracking-[-0.045em] text-text-primary">
            DTF printing<br />without the<br /><span className="text-primary-action">back-and-forth.</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-text-muted">Start with a print-ready gang sheet or upload individual designs for 2040 USA to arrange. The current experience saves a draft and does not submit an order.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="/order/start" showArrow>Start a Print</Button>
            <Button href="#process" variant="secondary">See How It Works</Button>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-text-secondary">
            <span><b className="mr-1 text-text-primary">01</b> Private upload</span><span><b className="mr-1 text-text-primary">02</b> File-linked sizing</span><span><b className="mr-1 text-text-primary">03</b> Saved draft</span>
          </div>
        </Reveal>
        <Reveal><ArtworkDropzonePreview /></Reveal>
      </div>
    </section>
  );
}
