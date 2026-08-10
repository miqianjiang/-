import type { ExperimentState, FaultCase, ProtectionCase, ScenarioPreset } from "./types";

export const defaultExperimentState: ExperimentState = {
  zeroSequenceHardPlate: true,
  zeroSequenceSoftPlate: true,
  stageThreeControlWord: true,
  currentCircuitState: "normal",
  testerFaultSettingCorrect: true,
  testerCurrent: 1.5,
  testerDuration: 2,
  currentSetting: 1,
  delaySetting: 1.5,
  maintenancePlate: true,
  tripOutletPlate: false,
  closeOutletPlate: false,
  testerOutputRunning: false
};

export const zeroSequenceStageThreePresets: ScenarioPreset[] = [
  {
    id: "normal-action",
    label: "正常动作",
    description: "全部条件满足，观察启动、延时和动作。",
    patch: {}
  },
  {
    id: "soft-plate-out",
    label: "软压板退出",
    description: "投入支路中断，启动满足但不动作。",
    patch: {
      zeroSequenceSoftPlate: false
    }
  },
  {
    id: "current-low",
    label: "电流不足",
    description: "3I0 未大于 I0.set，启动支路不成立。",
    patch: {
      testerCurrent: 0.8
    }
  },
  {
    id: "duration-short",
    label: "持续时间不足",
    description: "已启动但故障量先消失，延时复归。",
    patch: {
      testerDuration: 1
    }
  }
];

export const protectionCases: ProtectionCase[] = [
  {
    id: "zero-sequence-stage-three",
    title: "零序过流保护Ⅲ段动作逻辑",
    shortTitle: "零序Ⅲ段",
    description:
      "硬压板、软压板、Ⅲ段控制字共同决定投入；电流回路、测试仪故障量设置和电流判据共同决定启动；投入与启动共同决定最终动作允许。",
    logicType: "zeroSequenceStageThree",
    status: "available",
    defaultState: defaultExperimentState,
    presets: zeroSequenceStageThreePresets,
    notes: [
      "当前已接入动态逻辑图和确定性计算引擎。",
      "适合演示投入、启动、最终动作允许、延时和复归全过程。"
    ]
  },
  {
    id: "distance-stage-one",
    title: "距离保护Ⅰ段动作逻辑",
    shortTitle: "距离Ⅰ段",
    description: "预留给后续老师提供距离保护Ⅰ段静态逻辑图后接入。",
    logicType: "reserved",
    status: "reserved",
    defaultState: defaultExperimentState,
    presets: [],
    notes: ["该逻辑案例待接入。接入后将展示距离Ⅰ段自己的流程图、输入条件和动作规则。"]
  },
  {
    id: "reclosing-logic",
    title: "重合闸逻辑",
    shortTitle: "重合闸",
    description: "预留给后续重合闸条件、闭锁条件和延时逻辑接入。",
    logicType: "reserved",
    status: "reserved",
    defaultState: defaultExperimentState,
    presets: [],
    notes: ["该逻辑案例待接入。接入后将展示重合闸自己的流程图、闭锁条件和延时规则。"]
  },
  {
    id: "over-current-stage-two",
    title: "过流保护Ⅱ段动作逻辑",
    shortTitle: "过流Ⅱ段",
    description: "预留给后续过流保护Ⅱ段逻辑图和定值比较关系接入。",
    logicType: "reserved",
    status: "reserved",
    defaultState: defaultExperimentState,
    presets: [],
    notes: ["该逻辑案例待接入。接入后将展示过流Ⅱ段自己的流程图、定值比较和动作规则。"]
  }
];

export const zeroSequenceSoftPlateFault: FaultCase = {
  id: "zero-sequence-stage-three-soft-plate-out",
  title: "零序过流保护Ⅲ段软压板退出预留案例",
  task: "零序过流保护Ⅲ段试验时保护未动作，请沿保护逻辑查找原因。",
  hiddenFault: "零序过流保护Ⅲ段软压板退出",
  initialPhenomenon: "保护未动作",
  initialPatch: {
    zeroSequenceSoftPlate: false
  },
  expectedCause:
    "零序过流保护Ⅲ段未动作的原因是零序电流保护软压板处于退出状态，导致零序Ⅲ段投入节点为0。虽然电流回路、测试仪输出和电流比较判据均满足启动条件，但最终动作逻辑无法成立。投入软压板并重新试验后，零序Ⅲ段正常启动，完成延时并动作。"
};

export const faultCaseTemplates: FaultCase[] = [
  {
    ...zeroSequenceSoftPlateFault,
    id: "hard-plate-out",
    hiddenFault: "零序电流保护硬压板未投入",
    initialPatch: { zeroSequenceHardPlate: false },
    expectedCause: "零序电流保护硬压板未投入，导致零序Ⅲ段投入节点为0。"
  },
  zeroSequenceSoftPlateFault,
  {
    ...zeroSequenceSoftPlateFault,
    id: "control-word-out",
    hiddenFault: "零序过流保护Ⅲ段控制字未投入",
    initialPatch: { stageThreeControlWord: false },
    expectedCause: "零序过流保护Ⅲ段控制字未投入，导致零序Ⅲ段投入节点为0。"
  },
  {
    ...zeroSequenceSoftPlateFault,
    id: "current-circuit-incorrect",
    hiddenFault: "电流回路条件不满足",
    initialPatch: { currentCircuitState: "open" },
    expectedCause: "电流回路接线正确节点为0，导致零序Ⅲ段启动节点为0。"
  },
  {
    ...zeroSequenceSoftPlateFault,
    id: "tester-fault-setting-incorrect",
    hiddenFault: "测试仪故障量设置不正确",
    initialPatch: { testerFaultSettingCorrect: false },
    expectedCause: "测试仪故障量设置正确节点为0，导致零序Ⅲ段启动节点为0。"
  },
  {
    ...zeroSequenceSoftPlateFault,
    id: "current-below-setting",
    hiddenFault: "3I0未达到I0.set",
    initialPatch: { testerCurrent: 0.8 },
    expectedCause: "实际3I0未大于动作电流定值I0.set，电流比较判据为0。"
  },
  {
    ...zeroSequenceSoftPlateFault,
    id: "duration-too-short",
    hiddenFault: "故障持续时间不足以完成延时",
    initialPatch: { testerDuration: 1 },
    expectedCause: "动作允许已经成立，但故障持续时间小于动作时间定值，保护未完成延时便复归。"
  },
  {
    ...zeroSequenceSoftPlateFault,
    id: "combined-fault",
    hiddenFault: "多条件组合故障",
    initialPatch: { zeroSequenceSoftPlate: false, testerFaultSettingCorrect: false },
    expectedCause: "投入支路和启动支路均存在未满足条件，需要逐条逻辑链排查。"
  }
];

export function createInitialState(caseId = "zero-sequence-stage-three"): ExperimentState {
  const protectionCase = protectionCases.find((item) => item.id === caseId && item.status === "available");
  return { ...(protectionCase?.defaultState ?? defaultExperimentState) };
}
