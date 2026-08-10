export type CurrentCircuitState = "normal" | "open" | "wrongTerminal";

export type ExperimentState = {
  zeroSequenceHardPlate: boolean;
  zeroSequenceSoftPlate: boolean;
  stageThreeControlWord: boolean;
  currentCircuitState: CurrentCircuitState;
  testerFaultSettingCorrect: boolean;
  testerCurrent: number;
  testerDuration: number;
  currentSetting: number;
  delaySetting: number;
  maintenancePlate: boolean;
  tripOutletPlate: boolean;
  closeOutletPlate: boolean;
  testerOutputRunning: boolean;
};

export type LogicNodeState = {
  value: boolean;
  label: string;
  upstream: Record<string, boolean | number | string>;
  reason: string;
  unmetConditions: string[];
};

export type LogicSnapshot = {
  stageEnabled: boolean;
  currentCircuitCorrect: boolean;
  testerFaultSettingCorrect: boolean;
  circuitValid: boolean;
  measuredCurrent: number;
  actual3I0: number;
  currentCriterion: boolean;
  stageStarted: boolean;
  actionPermitted: boolean;
  elapsedTime: number;
  stageAction: boolean;
  nodes: {
    stageEnabled: LogicNodeState;
    currentCriterion: LogicNodeState;
    stageStarted: LogicNodeState;
    actionPermitted: LogicNodeState;
    delay: LogicNodeState;
    stageAction: LogicNodeState;
  };
  unmetConditions: string[];
  explanations: string[];
};

export type SafetyRule = {
  ruleId: string;
  when: (state: ExperimentState) => boolean;
  violationName: string;
  riskConsequence: string;
  prompt: string;
  handling: "warning" | "block" | "simulate";
  basis: string;
};

export type SafetyViolation = Omit<SafetyRule, "when">;

export type OperationRecord = {
  id: string;
  time: string;
  action: string;
  before?: string;
  after?: string;
  result: string;
};

export type ScenarioPreset = {
  id: string;
  label: string;
  description: string;
  patch: Partial<ExperimentState>;
};

export type ProtectionCase = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  logicType: "zeroSequenceStageThree" | "reserved";
  status: "available" | "reserved";
  defaultState: ExperimentState;
  presets: ScenarioPreset[];
  notes: string[];
};

export type FaultCase = {
  id: string;
  title: string;
  task: string;
  hiddenFault: string;
  initialPhenomenon: string;
  initialPatch: Partial<ExperimentState>;
  expectedCause: string;
};

export type EvaluationResult = {
  score: number;
  deductions: string[];
  dimensions: {
    faultLocation: number;
    faultRepair: number;
    retest: number;
    explanation: number;
  };
};
