export type OrderRoute = "gang-sheet" | "individual-designs";
export type OrderStepId = "start" | "artwork" | "review";

export type WidthSizeVariant = { id: string; method: "width"; width: number; quantity: number };
export type HeightSizeVariant = { id: string; method: "height"; height: number; quantity: number };
export type OriginalSizeVariant = { id: string; method: "original"; quantity: number };
export type SizeVariant = WidthSizeVariant | HeightSizeVariant | OriginalSizeVariant;

export type IndividualDesignConfiguration = {
  artworkId: string;
  sizes: SizeVariant[];
  wantsChanges: boolean;
  changeInstructions: string;
};

export type GangSheetFileConfiguration = {
  artworkId: string;
  copies: number;
  finishedWidth: number;
  finishedLength: number;
};

export type GangSheetConfiguration = {
  route: "gang-sheet";
  sheets: GangSheetFileConfiguration[];
  notes: string;
};

export type IndividualDesignsConfiguration = {
  route: "individual-designs";
  designs: IndividualDesignConfiguration[];
  notes: string;
};

export type OrderConfiguration = GangSheetConfiguration | IndividualDesignsConfiguration;

export type WorkingGangSheetConfiguration = {
  route: "gang-sheet";
  sheets: WorkingGangSheetFileConfiguration[];
  notes: string;
};

export type WorkingGangSheetFileConfiguration = {
  artworkId: string;
  copies: string;
  finishedWidth: string;
  finishedLength: string;
};

export type WorkingSizeVariant = {
  id: string;
  method: "" | "width" | "height" | "original";
  dimension: string;
  quantity: string;
};

export type WorkingIndividualDesignConfiguration = {
  artworkId: string;
  sizes: WorkingSizeVariant[];
  wantsChanges: "" | "no" | "yes";
  changeInstructions: string;
};

export type WorkingIndividualDesignsConfiguration = {
  route: "individual-designs";
  designs: WorkingIndividualDesignConfiguration[];
  notes: string;
};

export type WorkingOrderConfiguration = WorkingGangSheetConfiguration | WorkingIndividualDesignsConfiguration;
export type CompletedStep = 0 | 1 | 2 | 3;

export type OrderDraftSnapshot = {
  selectedRoute: OrderRoute | null;
  startingPointConfirmed: boolean;
  artworkAcknowledged: boolean;
  workingConfiguration: WorkingOrderConfiguration | null;
  configuration: OrderConfiguration | null;
  lastCompletedStep: CompletedStep;
};

export type DraftHydrationState = "initializing" | "ready" | "error";
export type DraftSaveState = "idle" | "saving" | "saved" | "error" | "conflict";

export type CanonicalOrderDraft = OrderDraftSnapshot & {
  id: string;
  version: number;
  status: "active";
  updatedAt: string;
};
