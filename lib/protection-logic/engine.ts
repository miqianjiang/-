import type {
  EvaluationResult,
  ExperimentState,
  LogicNodeState,
  LogicSnapshot,
  OperationRecord
} from "./types";

export function calculateProtectionLogic(
  state: ExperimentState,
  elapsedSeconds: number
): LogicSnapshot {
  if (state.logicType === "distanceStageTwo") return calculateDistanceStageTwoLogic(state, elapsedSeconds);
  if (state.logicType === "reclosingCharge") return calculateReclosingChargeLogic(state, elapsedSeconds);
  if (state.logicType === "overcurrentStageOne") return calculateOvercurrentStageOneLogic(state, elapsedSeconds);
  return calculateZeroSequenceProtectionLogic(state, elapsedSeconds);
}

function calculateZeroSequenceProtectionLogic(
  state: ExperimentState,
  elapsedSeconds: number
): LogicSnapshot {
  const stageEnabled =
    state.zeroSequenceHardPlate && state.zeroSequenceSoftPlate && state.stageThreeControlWord;
  const currentCircuitCorrect = state.currentCircuitState === "normal";
  const actual3I0 = state.testerCurrent;
  const measuredCurrent = actual3I0;
  const currentCriterion = actual3I0 > state.currentSetting;
  const stageStarted =
    currentCircuitCorrect && state.testerFaultSettingCorrect && currentCriterion;
  const actionPermitted = stageEnabled && stageStarted;
  const stageAction = actionPermitted && elapsedSeconds >= state.delaySetting;
  const unmetConditions: string[] = [];
  const explanations: string[] = [];
  const nodes = createLogicNodes({
    state,
    stageEnabled,
    currentCircuitCorrect,
    actual3I0,
    currentCriterion,
    stageStarted,
    actionPermitted,
    elapsedSeconds,
    stageAction
  });

  if (!state.zeroSequenceHardPlate) unmetConditions.push("零序电流保护硬压板未投入");
  if (!state.zeroSequenceSoftPlate) unmetConditions.push("零序电流保护软压板未投入");
  if (!state.stageThreeControlWord) unmetConditions.push("零序过流保护Ⅲ段控制字未投入");
  if (!currentCircuitCorrect) unmetConditions.push("电流回路接线正确条件不满足");
  if (!state.testerFaultSettingCorrect) unmetConditions.push("测试仪故障量设置正确条件不满足");
  if (!currentCriterion) {
    if (actual3I0 === state.currentSetting) {
      unmetConditions.push("当前3I0等于动作电流定值，未满足3I0>I0.set判据");
    } else {
      unmetConditions.push(
        `当前3I0=${formatNumber(actual3I0)}A，动作电流定值I0.set=${formatNumber(
          state.currentSetting
        )}A，不满足3I0>I0.set判据`
      );
    }
  }
  if (actionPermitted && !stageAction) {
    unmetConditions.push(
      `延时尚未完成，当前${formatNumber(elapsedSeconds)}s / ${formatNumber(state.delaySetting)}s`
    );
  }

  if (!state.zeroSequenceSoftPlate) {
    explanations.push(
      "零序电流保护软压板当前处于退出状态，因此零序Ⅲ段投入条件不成立。虽然故障电流可能已经超过动作电流定值，保护仍不能进入最终动作延时。"
    );
  }
  if (!currentCircuitCorrect) {
    explanations.push("电流回路接线正确节点为0，零序Ⅲ段启动条件不成立。");
  }
  if (!state.testerFaultSettingCorrect) {
    explanations.push("测试仪故障量设置正确节点为0，零序Ⅲ段启动条件不成立。");
  }
  if (!currentCriterion) {
    explanations.push(
      actual3I0 === state.currentSetting
        ? "当前3I0等于动作电流定值，未满足3I0>I0.set判据。"
        : `当前3I0=${formatNumber(actual3I0)}A，动作电流定值I0.set=${formatNumber(
            state.currentSetting
          )}A，不满足3I0>I0.set，因此零序Ⅲ段未启动。`
    );
  }
  if (stageStarted && state.testerDuration < state.delaySetting) {
    explanations.push(
      `零序Ⅲ段已经启动，但测试电流仅持续${formatNumber(
        state.testerDuration
      )}s，小于动作时间定值${formatNumber(state.delaySetting)}s，保护尚未完成延时便已经复归。`
    );
  }
  if (stageAction) {
    explanations.push("零序Ⅲ段投入、启动和延时条件均满足，保护动作节点输出1。");
  }

  return {
    stageEnabled,
    currentCircuitCorrect,
    testerFaultSettingCorrect: state.testerFaultSettingCorrect,
    circuitValid: currentCircuitCorrect,
    measuredCurrent,
    actual3I0,
    currentCriterion,
    stageStarted,
    actionPermitted,
    elapsedTime: elapsedSeconds,
    stageAction,
    nodes,
    unmetConditions,
    explanations
  };
}

function calculateDistanceStageTwoLogic(state: ExperimentState, elapsedSeconds: number): LogicSnapshot {
  const stageEnabled =
    state.distanceHardPlate && state.distanceSoftPlate && state.distanceStageTwoControlWord;
  const currentCircuitCorrect = state.currentCircuitState === "normal";
  const tvResetPath = state.voltageCircuitCorrect && state.preFaultStateCorrect && state.tvResetDone;
  const currentCriterion = state.impedanceValue < state.impedanceSetting;
  const stageStarted =
    currentCircuitCorrect && state.impedanceFaultSettingCorrect && tvResetPath && currentCriterion;
  const actionPermitted = stageEnabled && stageStarted;
  const stageAction = actionPermitted && elapsedSeconds >= state.delaySetting;
  const nodes = createCaseLogicNodes({
    stageEnabled,
    stageLabel: "接地距离Ⅱ段投入",
    stageReason: "距离保护硬压板、接地距离保护软压板和接地距离Ⅱ段控制字采用AND逻辑，全部为1时接地距离Ⅱ段投入为1。",
    stageInputs: {
      hardPlate: state.distanceHardPlate ? 1 : 0,
      softPlate: state.distanceSoftPlate ? 1 : 0,
      controlWord: state.distanceStageTwoControlWord ? 1 : 0
    },
    stageUnmet: [
      !state.distanceHardPlate ? "距离保护硬压板未投入" : "",
      !state.distanceSoftPlate ? "接地距离保护软压板未投入" : "",
      !state.distanceStageTwoControlWord ? "接地距离Ⅱ段控制字未投入" : ""
    ].filter(Boolean),
    currentCriterion,
    currentLabel: "Z < ZsetⅡ",
    currentReason: "阻抗比较判据要求测量阻抗Z小于接地距离Ⅱ段阻抗定值ZsetⅡ。",
    currentInputs: { z: state.impedanceValue, zset2: state.impedanceSetting },
    currentUnmet: currentCriterion ? [] : ["测量阻抗Z未小于接地距离Ⅱ段阻抗定值ZsetⅡ"],
    stageStarted,
    startLabel: "接地距离Ⅱ段启动",
    startReason: "电流回路、阻抗故障量、TV断线复归支路和阻抗判据全部满足时，接地距离Ⅱ段启动为1；其中TV断线复归支路由电压回路、故障前状态和TV断线复归共同决定。",
    startInputs: {
      currentCircuitCorrect: currentCircuitCorrect ? 1 : 0,
      voltageCircuitCorrect: state.voltageCircuitCorrect ? 1 : 0,
      preFaultStateCorrect: state.preFaultStateCorrect ? 1 : 0,
      impedanceFaultSettingCorrect: state.impedanceFaultSettingCorrect ? 1 : 0,
      tvResetDone: tvResetPath ? 1 : 0,
      impedanceCriterion: currentCriterion ? 1 : 0
    },
    startUnmet: [
      !currentCircuitCorrect ? "电流回路接线正确条件不满足" : "",
      !state.voltageCircuitCorrect ? "电压回路接线正确条件不满足" : "",
      !state.preFaultStateCorrect ? "故障前状态设置正确条件不满足" : "",
      !state.impedanceFaultSettingCorrect ? "阻抗故障量设置正确条件不满足" : "",
      !tvResetPath ? "TV断线复归支路未完成" : "",
      !currentCriterion ? "Z<ZsetⅡ判据不满足" : ""
    ].filter(Boolean),
    actionPermitted,
    elapsedSeconds,
    delaySetting: state.delaySetting,
    stageAction,
    actionLabel: "接地距离Ⅱ段动作",
    delayLabel: "tⅡ.set延时"
  });
  const unmetConditions = collectUnmet(nodes, actionPermitted, stageAction, elapsedSeconds, state.delaySetting);
  const explanations = buildCaseExplanations({
    stageEnabled,
    stageStarted,
    actionPermitted,
    stageAction,
    durationShort: state.testerDuration < state.delaySetting,
    currentCriterion,
    currentText: `当前Z=${formatNumber(state.impedanceValue)}Ω，ZsetⅡ=${formatNumber(state.impedanceSetting)}Ω`,
    caseName: "接地距离Ⅱ段"
  });
  return snapshotFromNodes(elapsedSeconds, nodes, {
    stageEnabled,
    currentCircuitCorrect,
    currentCriterion,
    stageStarted,
    actionPermitted,
    stageAction,
    actual3I0: state.impedanceValue,
    measuredCurrent: state.impedanceValue,
    testerFaultSettingCorrect: state.impedanceFaultSettingCorrect && tvResetPath,
    unmetConditions,
    explanations
  });
}

function calculateReclosingChargeLogic(state: ExperimentState, elapsedSeconds: number): LogicSnapshot {
  const stageEnabled =
    state.reclosingHardPlate &&
    state.reclosingSoftPlate &&
    state.reclosingStopControlOff &&
    state.reclosingBanControlOff &&
    state.noExternalBlockSignal;
  const currentCircuitCorrect = state.protectionNotStarted;
  const currentCriterion = state.breakerClosed;
  const stageStarted = state.protectionNotStarted && state.breakerClosed;
  const actionPermitted = stageEnabled && stageStarted;
  const stageAction = actionPermitted && elapsedSeconds >= state.chargeDelaySetting;
  const nodes = createCaseLogicNodes({
    stageEnabled,
    stageLabel: "重合闸投入允许",
    stageReason: "重合闸硬压板、软压板、停用重合闸控制字=0、禁用重合闸控制字=0且无外部闭锁重合闸信号时，充电投入允许为1。",
    stageInputs: {
      hardPlate: state.reclosingHardPlate ? 1 : 0,
      softPlate: state.reclosingSoftPlate ? 1 : 0,
      stopControlOff: state.reclosingStopControlOff ? 1 : 0,
      banControlOff: state.reclosingBanControlOff ? 1 : 0,
      noBlock: state.noExternalBlockSignal ? 1 : 0
    },
    stageUnmet: [
      !state.reclosingHardPlate ? "重合闸硬压板未投入" : "",
      !state.reclosingSoftPlate ? "重合闸软压板未投入" : "",
      !state.reclosingStopControlOff ? "停用重合闸控制字未为0" : "",
      !state.reclosingBanControlOff ? "禁用重合闸控制字未为0" : "",
      !state.noExternalBlockSignal ? "存在外部闭锁重合闸信号" : ""
    ].filter(Boolean),
    currentCriterion,
    currentLabel: "断路器合位",
    currentReason: "断路器合位是重合闸充电的运行状态条件，TWJ=0且HWJ=1时输出1。",
    currentInputs: { breakerClosed: currentCriterion ? 1 : 0 },
    currentUnmet: currentCriterion ? [] : ["断路器未处于合位"],
    stageStarted,
    startLabel: "充电运行条件",
    startReason: "保护未启动且断路器合位时，重合闸具备持续充电的运行条件。",
    startInputs: {
      protectionNotStarted: state.protectionNotStarted ? 1 : 0,
      breakerClosed: state.breakerClosed ? 1 : 0
    },
    startUnmet: [
      !state.protectionNotStarted ? "保护已启动" : "",
      !state.breakerClosed ? "断路器合位条件不满足" : ""
    ].filter(Boolean),
    actionPermitted,
    elapsedSeconds,
    delaySetting: state.chargeDelaySetting,
    stageAction,
    actionLabel: "重合闸充电成功",
    delayLabel: "tTVDX充电延时"
  });
  const unmetConditions = collectUnmet(nodes, actionPermitted, stageAction, elapsedSeconds, state.chargeDelaySetting);
  const explanations = buildCaseExplanations({
    stageEnabled,
    stageStarted,
    actionPermitted,
    stageAction,
    durationShort: state.testerDuration < state.chargeDelaySetting,
    currentCriterion,
    currentText: `断路器合位=${state.breakerClosed ? "1" : "0"}`,
    caseName: "重合闸充电"
  });
  return snapshotFromNodes(elapsedSeconds, nodes, {
    stageEnabled,
    currentCircuitCorrect,
    currentCriterion,
    stageStarted,
    actionPermitted,
    stageAction,
    actual3I0: state.breakerClosed ? 1 : 0,
    measuredCurrent: state.breakerClosed ? 1 : 0,
    testerFaultSettingCorrect: state.protectionNotStarted,
    unmetConditions,
    explanations
  });
}

function calculateOvercurrentStageOneLogic(state: ExperimentState, elapsedSeconds: number): LogicSnapshot {
  const stageEnabled = state.overcurrentHardPlate && state.overcurrentSoftPlate;
  const directionPath =
    !state.overcurrentDirectionalControl || state.overcurrentDirectionSatisfied;
  const voltagePath =
    !state.overcurrentLowVoltageBlockControl || state.overcurrentVoltageSatisfied;
  const currentCircuitCorrect = state.currentCircuitState === "normal";
  const ptExitPath = state.voltageCircuitCorrect && state.preFaultStateCorrect && state.ptTripReturned;
  const currentCriterion = state.phaseCurrent > state.phaseCurrentSetting;
  const stageStarted =
    currentCircuitCorrect && directionPath && voltagePath && ptExitPath && currentCriterion;
  const actionPermitted = stageEnabled && stageStarted;
  const stageAction = actionPermitted && elapsedSeconds >= state.delaySetting;
  const nodes = createCaseLogicNodes({
    stageEnabled,
    stageLabel: "过流Ⅰ段投入",
    stageReason: "过流I段硬压板和软压板采用AND逻辑，两者均投入时过流I段投入为1。",
    stageInputs: {
      hardPlate: state.overcurrentHardPlate ? 1 : 0,
      softPlate: state.overcurrentSoftPlate ? 1 : 0
    },
    stageUnmet: [
      !state.overcurrentHardPlate ? "过流I段硬压板未投入" : "",
      !state.overcurrentSoftPlate ? "过流I段软压板未投入" : ""
    ].filter(Boolean),
    currentCriterion,
    currentLabel: "I > Iset",
    currentReason: "过流电流判据要求实际相电流I大于过流I段动作电流定值Iset。",
    currentInputs: { current: state.phaseCurrent, setting: state.phaseCurrentSetting },
    currentUnmet: currentCriterion ? [] : ["实际相电流I未大于过流I段动作电流定值Iset"],
    stageStarted,
    startLabel: "过流Ⅰ段启动",
    startReason: "电流回路、方向条件、低压闭锁条件、PT断线退出支路和电流判据全部满足时，过流I段启动为1。",
    startInputs: {
      currentCircuitCorrect: currentCircuitCorrect ? 1 : 0,
      directionPath: directionPath ? 1 : 0,
      voltagePath: voltagePath ? 1 : 0,
      voltageCircuitCorrect: state.voltageCircuitCorrect ? 1 : 0,
      preFaultStateCorrect: state.preFaultStateCorrect ? 1 : 0,
      ptTripReturned: ptExitPath ? 1 : 0,
      currentCriterion: currentCriterion ? 1 : 0
    },
    startUnmet: [
      !currentCircuitCorrect ? "电流回路接线正确条件不满足" : "",
      !directionPath ? "方向条件不满足" : "",
      !voltagePath ? "低压闭锁条件不满足" : "",
      !state.voltageCircuitCorrect ? "电压回路接线正确条件不满足" : "",
      !state.preFaultStateCorrect ? "故障前状态设置正确条件不满足" : "",
      !ptExitPath ? "PT断线退出支路未完成" : "",
      !currentCriterion ? "I>Iset判据不满足" : ""
    ].filter(Boolean),
    actionPermitted,
    elapsedSeconds,
    delaySetting: state.delaySetting,
    stageAction,
    actionLabel: "过流Ⅰ段动作",
    delayLabel: "tⅠ.set延时"
  });
  const unmetConditions = collectUnmet(nodes, actionPermitted, stageAction, elapsedSeconds, state.delaySetting);
  const explanations = buildCaseExplanations({
    stageEnabled,
    stageStarted,
    actionPermitted,
    stageAction,
    durationShort: state.testerDuration < state.delaySetting,
    currentCriterion,
    currentText: `当前I=${formatNumber(state.phaseCurrent)}A，Iset=${formatNumber(state.phaseCurrentSetting)}A`,
    caseName: "过流Ⅰ段"
  });
  return snapshotFromNodes(elapsedSeconds, nodes, {
    stageEnabled,
    currentCircuitCorrect,
    currentCriterion,
    stageStarted,
    actionPermitted,
    stageAction,
    actual3I0: state.phaseCurrent,
    measuredCurrent: state.phaseCurrent,
    testerFaultSettingCorrect: directionPath && voltagePath && ptExitPath,
    unmetConditions,
    explanations
  });
}

function createLogicNodes(args: {
  state: ExperimentState;
  stageEnabled: boolean;
  currentCircuitCorrect: boolean;
  actual3I0: number;
  currentCriterion: boolean;
  stageStarted: boolean;
  actionPermitted: boolean;
  elapsedSeconds: number;
  stageAction: boolean;
}): LogicSnapshot["nodes"] {
  const {
    state,
    stageEnabled,
    currentCircuitCorrect,
    actual3I0,
    currentCriterion,
    stageStarted,
    actionPermitted,
    elapsedSeconds,
    stageAction
  } = args;

  const node = (
    value: boolean,
    label: string,
    upstream: LogicNodeState["upstream"],
    unmetConditions: string[],
    reason: string
  ): LogicNodeState => ({ value, label, upstream, unmetConditions, reason });

  return {
    stageEnabled: node(
      stageEnabled,
      "零序Ⅲ段投入",
      {
        hardPlate: state.zeroSequenceHardPlate ? 1 : 0,
        softPlate: state.zeroSequenceSoftPlate ? 1 : 0,
        controlWord: state.stageThreeControlWord ? 1 : 0
      },
      [
        !state.zeroSequenceHardPlate ? "零序电流保护硬压板未投入" : "",
        !state.zeroSequenceSoftPlate ? "零序电流保护软压板未投入" : "",
        !state.stageThreeControlWord ? "零序过流保护Ⅲ段控制字未投入" : ""
      ].filter(Boolean),
      "硬压板、软压板和Ⅲ段控制字采用AND逻辑，三个输入全部为1时零序Ⅲ段投入为1。"
    ),
    currentCriterion: node(
      currentCriterion,
      "3I0 > I0.set",
      {
        actual3I0,
        currentSetting: state.currentSetting
      },
      currentCriterion
        ? []
        : [
            actual3I0 === state.currentSetting
              ? "当前3I0等于动作电流定值，未满足严格大于判据"
              : "当前3I0未大于动作电流定值I0.set"
          ],
      "电流比较判据必须严格满足实际3I0大于动作电流定值I0.set。"
    ),
    stageStarted: node(
      stageStarted,
      "零序Ⅲ段启动",
      {
        currentCircuitCorrect: currentCircuitCorrect ? 1 : 0,
        testerFaultSettingCorrect: state.testerFaultSettingCorrect ? 1 : 0,
        currentCriterion: currentCriterion ? 1 : 0
      },
      [
        !currentCircuitCorrect ? "电流回路接线正确条件不满足" : "",
        !state.testerFaultSettingCorrect ? "测试仪故障量设置正确条件不满足" : "",
        !currentCriterion ? "3I0>I0.set判据不满足" : ""
      ].filter(Boolean),
      "电流回路接线正确、测试仪故障量设置正确、电流比较判据三个条件全部为1时零序Ⅲ段启动为1。"
    ),
    actionPermitted: node(
      actionPermitted,
      "最终动作允许",
      {
        stageEnabled: stageEnabled ? 1 : 0,
        stageStarted: stageStarted ? 1 : 0
      },
      [
        !stageEnabled ? "零序Ⅲ段投入为0" : "",
        !stageStarted ? "零序Ⅲ段启动为0" : ""
      ].filter(Boolean),
      "零序Ⅲ段投入和零序Ⅲ段启动采用AND逻辑，两者同时为1时最终动作允许为1。"
    ),
    delay: node(
      actionPermitted && elapsedSeconds >= state.delaySetting,
      "t0.set延时",
      {
        actionPermitted: actionPermitted ? 1 : 0,
        elapsedTime: elapsedSeconds,
        delaySetting: state.delaySetting
      },
      actionPermitted && elapsedSeconds < state.delaySetting
        ? ["延时尚未达到动作时间定值"]
        : !actionPermitted
          ? ["最终动作允许为0，延时不启动"]
          : [],
      "最终动作允许为1后开始累计延时，累计时间达到t0.set后延时完成。"
    ),
    stageAction: node(
      stageAction,
      "零序Ⅲ段动作",
      {
        actionPermitted: actionPermitted ? 1 : 0,
        delayFinished: actionPermitted && elapsedSeconds >= state.delaySetting ? 1 : 0
      },
      [
        !actionPermitted ? "最终动作允许为0" : "",
        actionPermitted && elapsedSeconds < state.delaySetting ? "延时未完成" : ""
      ].filter(Boolean),
      "最终动作允许为1且延时完成后，零序Ⅲ段动作节点输出1。"
    )
  };
}

function createCaseLogicNodes(args: {
  stageEnabled: boolean;
  stageLabel: string;
  stageReason: string;
  stageInputs: LogicNodeState["upstream"];
  stageUnmet: string[];
  currentCriterion: boolean;
  currentLabel: string;
  currentReason: string;
  currentInputs: LogicNodeState["upstream"];
  currentUnmet: string[];
  stageStarted: boolean;
  startLabel: string;
  startReason: string;
  startInputs: LogicNodeState["upstream"];
  startUnmet: string[];
  actionPermitted: boolean;
  elapsedSeconds: number;
  delaySetting: number;
  stageAction: boolean;
  actionLabel: string;
  delayLabel: string;
}): LogicSnapshot["nodes"] {
  const node = (
    value: boolean,
    label: string,
    upstream: LogicNodeState["upstream"],
    unmetConditions: string[],
    reason: string
  ): LogicNodeState => ({ value, label, upstream, unmetConditions, reason });

  return {
    stageEnabled: node(
      args.stageEnabled,
      args.stageLabel,
      args.stageInputs,
      args.stageUnmet,
      args.stageReason
    ),
    currentCriterion: node(
      args.currentCriterion,
      args.currentLabel,
      args.currentInputs,
      args.currentUnmet,
      args.currentReason
    ),
    stageStarted: node(
      args.stageStarted,
      args.startLabel,
      args.startInputs,
      args.startUnmet,
      args.startReason
    ),
    actionPermitted: node(
      args.actionPermitted,
      "最终动作允许",
      {
        stageEnabled: args.stageEnabled ? 1 : 0,
        stageStarted: args.stageStarted ? 1 : 0
      },
      [
        !args.stageEnabled ? `${args.stageLabel}为0` : "",
        !args.stageStarted ? `${args.startLabel}为0` : ""
      ].filter(Boolean),
      `${args.stageLabel}和${args.startLabel}采用AND逻辑，两者同时为1时最终动作允许为1。`
    ),
    delay: node(
      args.actionPermitted && args.elapsedSeconds >= args.delaySetting,
      args.delayLabel,
      {
        actionPermitted: args.actionPermitted ? 1 : 0,
        elapsedTime: args.elapsedSeconds,
        delaySetting: args.delaySetting
      },
      args.actionPermitted && args.elapsedSeconds < args.delaySetting
        ? ["延时尚未达到动作时间定值"]
        : !args.actionPermitted
          ? ["最终动作允许为0，延时不启动"]
          : [],
      "最终动作允许为1后开始累计延时，累计时间达到定值后延时完成。"
    ),
    stageAction: node(
      args.stageAction,
      args.actionLabel,
      {
        actionPermitted: args.actionPermitted ? 1 : 0,
        delayFinished: args.actionPermitted && args.elapsedSeconds >= args.delaySetting ? 1 : 0
      },
      [
        !args.actionPermitted ? "最终动作允许为0" : "",
        args.actionPermitted && args.elapsedSeconds < args.delaySetting ? "延时未完成" : ""
      ].filter(Boolean),
      `最终动作允许为1且延时完成后，${args.actionLabel}节点输出1。`
    )
  };
}

function collectUnmet(
  nodes: LogicSnapshot["nodes"],
  actionPermitted: boolean,
  stageAction: boolean,
  elapsedSeconds: number,
  delaySetting: number
) {
  const unmetConditions = [
    ...nodes.stageEnabled.unmetConditions,
    ...nodes.stageStarted.unmetConditions
  ];
  if (actionPermitted && !stageAction) {
    unmetConditions.push(`延时尚未完成，当前${formatNumber(elapsedSeconds)}s / ${formatNumber(delaySetting)}s`);
  }
  return unmetConditions;
}

function buildCaseExplanations(args: {
  stageEnabled: boolean;
  stageStarted: boolean;
  actionPermitted: boolean;
  stageAction: boolean;
  durationShort: boolean;
  currentCriterion: boolean;
  currentText: string;
  caseName: string;
}) {
  const explanations: string[] = [];
  if (!args.stageEnabled) explanations.push(`${args.caseName}投入支路不满足，最终动作允许不能成立。`);
  if (!args.currentCriterion) explanations.push(`${args.currentText}，判据不满足，启动支路不成立。`);
  if (!args.stageStarted) explanations.push(`${args.caseName}启动支路存在未满足条件，请沿启动条件逐项排查。`);
  if (args.stageStarted && args.durationShort) explanations.push(`${args.caseName}已经启动，但故障量持续时间不足，延时尚未完成便复归。`);
  if (args.actionPermitted && !args.stageAction) explanations.push(`${args.caseName}投入与启动均满足，正在等待延时完成。`);
  if (args.stageAction) explanations.push(`${args.caseName}投入、启动和延时条件均满足，动作节点输出1。`);
  return explanations;
}

function snapshotFromNodes(
  elapsedSeconds: number,
  nodes: LogicSnapshot["nodes"],
  values: Omit<LogicSnapshot, "nodes" | "elapsedTime" | "explanations" | "unmetConditions" | "circuitValid"> & {
    unmetConditions: string[];
    explanations: string[];
  }
): LogicSnapshot {
  return {
    stageEnabled: values.stageEnabled,
    currentCircuitCorrect: values.currentCircuitCorrect,
    testerFaultSettingCorrect: values.testerFaultSettingCorrect,
    circuitValid: values.currentCircuitCorrect,
    measuredCurrent: values.measuredCurrent,
    actual3I0: values.actual3I0,
    currentCriterion: values.currentCriterion,
    stageStarted: values.stageStarted,
    actionPermitted: values.actionPermitted,
    elapsedTime: elapsedSeconds,
    stageAction: values.stageAction,
    nodes,
    unmetConditions: values.unmetConditions,
    explanations: values.explanations
  };
}

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2).replace(/0$/, "");
}

export function explainCircuitState(state: ExperimentState): string {
  if (state.currentCircuitState === "normal") return "电流回路接线正确=1。";
  if (state.currentCircuitState === "open") return "电流回路接线正确=0，当前底层状态为回路开路。";
  return "电流回路接线正确=0，当前底层状态为端子接错。";
}

export function buildLogicExplanation(snapshot: LogicSnapshot, state: ExperimentState): string {
  if (state.logicType !== "zeroSequenceStageThree") {
    if (!snapshot.stageEnabled) return `${snapshot.nodes.stageEnabled.label}为0：${snapshot.nodes.stageEnabled.unmetConditions.join("，") || "投入条件未满足"}。`;
    if (!snapshot.stageStarted) return `${snapshot.nodes.stageStarted.label}为0：${snapshot.nodes.stageStarted.unmetConditions.join("，") || "启动条件未满足"}。`;
    if (snapshot.actionPermitted && !snapshot.stageAction) {
      return `${snapshot.nodes.stageEnabled.label}和${snapshot.nodes.stageStarted.label}均为1，最终动作允许为1。开始推演后累计延时，延时完成前动作节点保持为0。`;
    }
    if (snapshot.stageAction) return `${snapshot.nodes.stageAction.label}已经输出1，说明投入、启动和延时条件均满足。`;
    return "当前逻辑条件已计算完成，请改变任一保护条件观察节点0/1和线路状态变化。";
  }

  if (!state.zeroSequenceSoftPlate) {
    return "零序电流保护软压板当前为0，因此零序Ⅲ段投入节点为0。虽然启动支路可能已经满足，但最终动作允许仍为0，保护不会进入延时动作。";
  }

  if (!state.zeroSequenceHardPlate) {
    return "零序电流保护硬压板当前为0，投入支路不满足，零序Ⅲ段投入为0。";
  }

  if (!state.stageThreeControlWord) {
    return "零序过流保护Ⅲ段控制字当前为0，投入支路不满足，零序Ⅲ段投入为0。";
  }

  if (!snapshot.currentCircuitCorrect) {
    return "电流回路接线正确节点为0，启动支路不满足，零序Ⅲ段启动为0。";
  }

  if (!state.testerFaultSettingCorrect) {
    return "测试仪故障量设置正确节点为0，启动支路不满足，零序Ⅲ段启动为0。";
  }

  if (!snapshot.currentCriterion) {
    if (snapshot.actual3I0 === state.currentSetting) {
      return "当前3I0等于I0.set。由于判据要求严格大于，电流比较节点为0。";
    }

    return `当前3I0=${formatNumber(snapshot.actual3I0)}A，I0.set=${formatNumber(
      state.currentSetting
    )}A，不满足3I0>I0.set，零序Ⅲ段启动为0。`;
  }

  if (snapshot.stageStarted && state.testerDuration < state.delaySetting) {
    return "零序Ⅲ段已经启动，但故障量持续时间小于动作时间定值，保护尚未完成延时便复归。";
  }

  if (snapshot.actionPermitted && !snapshot.stageAction) {
    return "零序Ⅲ段投入和启动均为1，最终动作允许为1。点击开始推演后进入t0.set延时，延时完成前动作节点保持为0。";
  }

  if (snapshot.stageAction) {
    return "零序Ⅲ段投入、启动和最终动作允许均为1，且延时已经达到t0.set，零序Ⅲ段动作节点为1。";
  }

  return "当前逻辑条件已计算完成，请改变任一保护条件观察节点0/1和线路状态变化。";
}

export function evaluateFaultTask(args: {
  records: OperationRecord[];
  finalAnswer: string;
  usedDirectHints: number;
  retestPassed: boolean;
  safetyViolationCount: number;
  finalSnapshot: LogicSnapshot;
}): EvaluationResult {
  const answer = args.finalAnswer;
  const locatedSoftPlate = answer.includes("软压板") && /退出|未投入|未投/.test(answer);
  const mentionsLogic =
    answer.includes("投入") &&
    (answer.includes("最终") || answer.includes("动作") || answer.includes("允许"));
  const repairedSoftPlate = args.records.some(
    (record) => record.action === "故障修复" && record.after?.includes("投入")
  );
  const dimensions = {
    faultLocation: locatedSoftPlate ? 40 : answer.trim() ? 12 : 0,
    faultRepair: repairedSoftPlate || args.finalSnapshot.stageEnabled ? 30 : 0,
    retest: args.retestPassed ? 20 : 0,
    explanation: mentionsLogic ? 10 : answer.length > 16 ? 5 : 0
  };
  const deductions: string[] = [];

  if (args.usedDirectHints > 0) deductions.push("使用L3直接提示：-10。");
  if (!args.retestPassed) deductions.push("修复后未重新验证，复测项不得分。");
  if (!locatedSoftPlate && answer.trim()) deductions.push("结论和逻辑状态不一致。");

  const rawScore = Object.values(dimensions).reduce((sum, value) => sum + value, 0);
  const penalty = args.usedDirectHints > 0 ? 10 : 0;

  return {
    score: Math.max(0, Math.min(100, rawScore - penalty)),
    deductions,
    dimensions
  };
}
