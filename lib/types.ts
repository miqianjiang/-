export type Selection = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DrawingAnalysis = {
  mode: "demo" | "live";
  sourceType: "teacher" | "textbook" | "ai";
  sourceLabel: string;
  sourceNote: string;
  title: string;
  recognizedText: string[];
  componentType: string;
  functionDescription: string;
  circuitRelation: string;
  actionLogic: string;
  safetyNotes: string[];
  caseRegion?: string;
  textbookHint?: string;
  learningGuide?: string[];
  confidence: "高" | "中" | "低";
  disclaimer: string;
};
