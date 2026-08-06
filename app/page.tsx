import { AdditionalServices } from "@/components/home/additional-services";
import { CapabilityStrip } from "@/components/home/capability-strip";
import { Hero } from "@/components/home/hero";
import { OrderExperiencePreview } from "@/components/home/order-experience-preview";
import { ProcessTimeline } from "@/components/home/process-timeline";
import { ProductionDashboardPreview } from "@/components/home/production-dashboard-preview";
import { QualityShowcase } from "@/components/home/quality-showcase";
import { RepeatBusinessPanel } from "@/components/home/repeat-business-panel";
import { WorkflowSelector } from "@/components/home/workflow-selector";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <CapabilityStrip />
        <WorkflowSelector />
        <ProcessTimeline />
        <div className="section-space border-b border-border">
          <div className="page-shell grid gap-5 lg:grid-cols-3">
            <QualityShowcase />
            <RepeatBusinessPanel />
            <AdditionalServices />
          </div>
        </div>
        <div className="section-space border-b border-border bg-raised">
          <div className="page-shell grid gap-4 xl:grid-cols-2">
            <OrderExperiencePreview />
            <ProductionDashboardPreview />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
