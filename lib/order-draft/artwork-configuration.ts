import { individualDesignsConfigurationSchema, workingOrderConfigurationSchema } from "@/lib/order-draft/schemas";
import type { IndividualDesignsConfiguration, WorkingIndividualDesignsConfiguration } from "@/lib/order-draft/types";

export function createWorkingDesign(artworkId: string) {
  return { artworkId, sizes: [{ id: crypto.randomUUID(), method: "" as const, dimension: "", quantity: "1" }], wantsChanges: "" as const, changeInstructions: "" };
}

export function addWorkingArtwork(configuration: unknown, artworkId: string): WorkingIndividualDesignsConfiguration {
  const parsed = workingOrderConfigurationSchema.safeParse(configuration);
  const current = parsed.success && parsed.data.route === "individual-designs" ? parsed.data : { route: "individual-designs" as const, designs: [], notes: "" };
  return current.designs.some((design) => design.artworkId === artworkId) ? current : { ...current, designs: [...current.designs, createWorkingDesign(artworkId)] };
}

export function pruneArtworkConfiguration(configuration: unknown, artworkId: string) {
  const working = workingOrderConfigurationSchema.safeParse(configuration);
  if (working.success && working.data.route === "individual-designs") {
    return { ...working.data, designs: working.data.designs.filter((design) => design.artworkId !== artworkId) };
  }
  const completed = individualDesignsConfigurationSchema.safeParse(configuration);
  if (completed.success) {
    const designs = completed.data.designs.filter((design) => design.artworkId !== artworkId);
    return designs.length ? { ...completed.data, designs } : null;
  }
  return configuration;
}

export function rebindArtworkConfiguration(configuration: unknown, previousArtworkId: string, nextArtworkId: string) {
  if (configuration === null) return null;
  const working = workingOrderConfigurationSchema.safeParse(configuration);
  if (working.success && working.data.route === "individual-designs") {
    return { ...working.data, designs: working.data.designs.map((design) => design.artworkId === previousArtworkId ? { ...design, artworkId: nextArtworkId } : design) };
  }
  const completed = individualDesignsConfigurationSchema.safeParse(configuration);
  if (completed.success) {
    return { ...completed.data, designs: completed.data.designs.map((design) => design.artworkId === previousArtworkId ? { ...design, artworkId: nextArtworkId } : design) } satisfies IndividualDesignsConfiguration;
  }
  return configuration;
}
