export const LEGACY_INDIVIDUAL_DESIGNS_ROUTES = ["separate-artwork", "transfers-by-size", "full-apparel"] as const;
export type LegacyIndividualDesignsRoute = (typeof LEGACY_INDIVIDUAL_DESIGNS_ROUTES)[number];

export function migrateLegacyRoute(route: "gang-sheet" | LegacyIndividualDesignsRoute) {
  return route === "gang-sheet" ? "gang-sheet" as const : "individual-designs" as const;
}
