export type OrderRoute =
  | "gang-sheet"
  | "separate-artwork"
  | "transfers-by-size"
  | "full-apparel";

export type OrderStepId = "start" | "artwork" | "configure" | "review";

export type DraftRow = {
  id: string;
  width: number;
  quantity: number;
};

export type DesignRow = DraftRow & {
  label: string;
};

export type GangSheetConfiguration = {
  route: "gang-sheet";
  sheetCount: number;
  finishedWidth: number;
  finishedLength: number;
  notes: string;
};

export type SeparateArtworkConfiguration = {
  route: "separate-artwork";
  designs: DesignRow[];
  notes: string;
};

export type TransfersBySizeConfiguration = {
  route: "transfers-by-size";
  designLabel: string;
  sizes: DraftRow[];
  notes: string;
};

export const garmentSources = [
  "customer-supplies",
  "2040-supplies",
  "not-sure",
] as const;
export type GarmentSource = (typeof garmentSources)[number];

export const projectTypes = [
  "t-shirts",
  "hoodies-sweatshirts",
  "caps",
  "mixed-apparel",
  "other-not-sure",
] as const;
export type ProjectType = (typeof projectTypes)[number];

export const printLocations = [
  "front",
  "back",
  "left-sleeve",
  "right-sleeve",
  "other-not-sure",
] as const;
export type PrintLocation = (typeof printLocations)[number];

export type FullApparelConfiguration = {
  route: "full-apparel";
  garmentSource: GarmentSource;
  projectType: ProjectType;
  garmentQuantity: number;
  printLocations: PrintLocation[];
  notes: string;
};

export type OrderConfiguration =
  | GangSheetConfiguration
  | SeparateArtworkConfiguration
  | TransfersBySizeConfiguration
  | FullApparelConfiguration;

export type WorkingDraftRow = {
  id: string;
  width: string;
  quantity: string;
};

export type WorkingDesignRow = WorkingDraftRow & {
  label: string;
};

export type WorkingGangSheetConfiguration = {
  route: "gang-sheet";
  sheetCount: string;
  finishedWidth: string;
  finishedLength: string;
  notes: string;
};

export type WorkingSeparateArtworkConfiguration = {
  route: "separate-artwork";
  designs: WorkingDesignRow[];
  notes: string;
};

export type WorkingTransfersBySizeConfiguration = {
  route: "transfers-by-size";
  designLabel: string;
  sizes: WorkingDraftRow[];
  notes: string;
};

export type WorkingFullApparelConfiguration = {
  route: "full-apparel";
  garmentSource: GarmentSource | "";
  projectType: ProjectType | "";
  garmentQuantity: string;
  printLocations: PrintLocation[];
  notes: string;
};

export type WorkingOrderConfiguration =
  | WorkingGangSheetConfiguration
  | WorkingSeparateArtworkConfiguration
  | WorkingTransfersBySizeConfiguration
  | WorkingFullApparelConfiguration;

export type CompletedStep = 0 | 1 | 2 | 3;

export type OrderDraftSnapshot = {
  selectedRoute: OrderRoute | null;
  startingPointConfirmed: boolean;
  artworkAcknowledged: boolean;
  workingConfiguration: WorkingOrderConfiguration | null;
  configuration: OrderConfiguration | null;
  lastCompletedStep: CompletedStep;
};
