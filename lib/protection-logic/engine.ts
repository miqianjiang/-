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

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2).replace(/0$/, "");
}

export function explainCircuitState(state: ExperimentState): string {
  if (state.currentCircuitState === "normal") return "电流回路接线正确=1。";
  if (state.currentCircuitState === "open") return "电流回路接线正确=0，当前底层状态为回路开路。";
  return "电流回路接线正确=0，当前底层状态为端子接错。";
}

export function buildLogicExplanation(snapshot: LogicSnapshot, state: ExperimentState): string {
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
