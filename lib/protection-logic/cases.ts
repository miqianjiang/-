import type { ExperimentState, FaultCase, ProtectionCase, ScenarioPreset } from "./types";

export const defaultExperimentState: ExperimentState = {
  logicType: "zeroSequenceStageThree",
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
  testerOutputRunning: false,
  distanceHardPlate: true,
  distanceSoftPlate: true,
  distanceStageTwoControlWord: true,
  voltageCircuitCorrect: true,
  preFaultStateCorrect: true,
  impedanceFaultSettingCorrect: true,
  tvResetDone: true,
  impedanceValue: 3.5,
  impedanceSetting: 5,
  reclosingHardPlate: true,
  reclosingSoftPlate: true,
  reclosingStopControlOff: true,
  reclosingBanControlOff: true,
  noExternalBlockSignal: true,
  protectionNotStarted: true,
  breakerClosed: true,
  chargeDelaySetting: 15,
  overcurrentHardPlate: true,
  overcurrentSoftPlate: true,
  overcurrentDirectionSatisfied: true,
  overcurrentVoltageSatisfied: true,
  overcurrentDirectionalControl: true,
  overcurrentLowVoltageBlockControl: true,
  ptTripReturned: true,
  phaseCurrent: 5,
  phaseCurrentSetting: 4
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

export const distanceStageTwoPresets: ScenarioPreset[] = [
  {
    id: "distance-normal-action",
    label: "正常动作",
    description: "投入、复归、阻抗判据和延时均满足。",
    patch: {}
  },
  {
    id: "distance-soft-plate-out",
    label: "软压板退出",
    description: "接地距离保护投入支路中断。",
    patch: { distanceSoftPlate: false }
  },
  {
    id: "distance-impedance-high",
    label: "阻抗偏大",
    description: "Z 未小于 ZsetⅡ，距离II段不启动。",
    patch: { impedanceValue: 6 }
  },
  {
    id: "distance-tv-not-reset",
    label: "TV未复归",
    description: "TV断线复归未完成，启动支路不成立。",
    patch: { tvResetDone: false }
  }
];

export const reclosingChargePresets: ScenarioPreset[] = [
  {
    id: "charge-success",
    label: "充电成功",
    description: "重合闸投入、无闭锁、开关合位，15s后充电成功。",
    patch: { testerDuration: 18 }
  },
  {
    id: "charge-protection-started",
    label: "保护启动",
    description: "保护启动时重合闸充电条件被打断。",
    patch: { protectionNotStarted: false, testerDuration: 18 }
  },
  {
    id: "charge-breaker-open",
    label: "断路器未合",
    description: "断路器合位条件不满足。",
    patch: { breakerClosed: false, testerDuration: 18 }
  },
  {
    id: "charge-blocked",
    label: "外部闭锁",
    description: "存在外部闭锁重合闸信号。",
    patch: { noExternalBlockSignal: false, testerDuration: 18 }
  }
];

export const overcurrentStageOnePresets: ScenarioPreset[] = [
  {
    id: "overcurrent-normal-action",
    label: "正常动作",
    description: "投入、方向/低压闭锁、电流判据和延时均满足。",
    patch: {}
  },
  {
    id: "overcurrent-current-low",
    label: "电流不足",
    description: "I 未大于 Iset，过流I段不启动。",
    patch: { phaseCurrent: 3.5 }
  },
  {
    id: "overcurrent-direction-bad",
    label: "方向不满足",
    description: "方向控制投入时故障量方向不满足。",
    patch: { overcurrentDirectionSatisfied: false }
  },
  {
    id: "overcurrent-pt-not-reset",
    label: "PT未复归",
    description: "PT断线退出未完成，闭锁启动支路。",
    patch: { ptTripReturned: false }
  }
];

const distanceStageTwoDefaultState: ExperimentState = {
  ...defaultExperimentState,
  logicType: "distanceStageTwo",
  currentSetting: 5,
  testerCurrent: 3.5,
  delaySetting: 1.5,
  testerDuration: 2,
  impedanceValue: 3.5,
  impedanceSetting: 5
};

const reclosingChargeDefaultState: ExperimentState = {
  ...defaultExperimentState,
  logicType: "reclosingCharge",
  delaySetting: 15,
  chargeDelaySetting: 15,
  testerDuration: 18
};

const overcurrentStageOneDefaultState: ExperimentState = {
  ...defaultExperimentState,
  logicType: "overcurrentStageOne",
  currentSetting: 4,
  testerCurrent: 5,
  phaseCurrent: 5,
  phaseCurrentSetting: 4,
  delaySetting: 0.5,
  testerDuration: 1
};

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
    id: "distance-stage-two",
    title: "接地距离保护Ⅱ段动作逻辑",
    shortTitle: "距离Ⅱ段",
    description:
      "距离保护硬压板、接地距离软压板和Ⅱ段控制字决定投入；电流回路、阻抗故障量、TV断线复归支路和阻抗判据决定启动；投入与启动共同进入延时动作。",
    logicType: "distanceStageTwo",
    status: "available",
    defaultState: distanceStageTwoDefaultState,
    presets: distanceStageTwoPresets,
    notes: [
      "已按老师提供的距离II段逻辑图接入独立推演。",
      "重点观察 Z < ZsetⅡ、TV断线复归支路和接地距离II段投入对最终动作的影响。"
    ]
  },
  {
    id: "reclosing-logic",
    title: "重合闸充电逻辑",
    shortTitle: "重合闸",
    description:
      "重合闸硬压板、软压板、停用/禁用控制字和外部闭锁共同决定充电允许；保护未启动与断路器合位共同确认运行条件，满足后经15s完成充电。",
    logicType: "reclosingCharge",
    status: "available",
    defaultState: reclosingChargeDefaultState,
    presets: reclosingChargePresets,
    notes: [
      "已按老师提供的重合闸充电逻辑图接入独立推演。",
      "对应现象：充电完成信号灯常亮；闪烁表示正在充电，不亮表示放电。"
    ]
  },
  {
    id: "over-current-stage-one",
    title: "过流保护Ⅰ段动作逻辑",
    shortTitle: "过流Ⅰ段",
    description:
      "过流I段硬压板、软压板决定投入；电流回路、方向/低压闭锁条件、PT断线退出支路和电流判据共同决定启动；投入与启动共同进入I段延时动作。",
    logicType: "overcurrentStageOne",
    status: "available",
    defaultState: overcurrentStageOneDefaultState,
    presets: overcurrentStageOnePresets,
    notes: [
      "已按老师提供的过流I段逻辑图接入独立推演。",
      "重点观察 I > Iset、方向控制字、低压闭锁控制字和PT断线退出支路对启动支路的影响。"
    ]
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
