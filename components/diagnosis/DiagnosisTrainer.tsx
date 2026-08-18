"use client";

import Link from "next/link";
import type { ChangeEvent, MouseEvent, ReactNode, WheelEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createInitialState, protectionCases } from "@/lib/protection-logic/cases";
import {
  buildLogicExplanation,
  calculateProtectionLogic,
  formatNumber
} from "@/lib/protection-logic/engine";
import type {
  ExperimentState,
  LogicSnapshot,
  OperationRecord,
  ProtectionCase,
  ScenarioPreset
} from "@/lib/protection-logic/types";

const currentCircuitLabels = {
  normal: "正常",
  open: "开路",
  wrongTerminal: "端子接错"
};

type FlowStage = "idle" | "enable" | "start" | "permit" | "delay" | "action";

type NodeLearningImage = {
  alt: string;
  caption: string;
  src: string;
};

type NodeLearningMaterial = {
  title: string;
  subtitle: string;
  value: boolean;
  statusText: string;
  textbook?: {
    source: string;
    text: string;
  };
  summary: string;
  images: NodeLearningImage[];
  steps: string[];
  currentBasis: string;
};

type ManualInterpretationState = {
  fileName: string;
  status: "idle" | "analyzing" | "ready";
};

function nowLabel() {
  return new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function boolText(value: boolean) {
  return value ? "投入" : "退出";
}

function getFlowStage(running: boolean, elapsed: number, stageAction: boolean): FlowStage {
  if (!running) return "idle";
  if (stageAction) return "action";
  if (elapsed < 0.2) return "enable";
  if (elapsed < 0.4) return "start";
  if (elapsed < 0.6) return "permit";
  return "delay";
}

function stageReached(current: FlowStage, target: FlowStage) {
  const order: FlowStage[] = ["idle", "enable", "start", "permit", "delay", "action"];
  if (current === "idle") return true;
  return order.indexOf(current) >= order.indexOf(target);
}

export default function DiagnosisTrainer({ initialCaseId = "zero-sequence-stage-three" }: { initialCaseId?: string }) {
  const initialCase =
    protectionCases.find((item) => item.id === initialCaseId) ?? protectionCases[0];
  const [experiment, setExperiment] = useState<ExperimentState>(() => createInitialState(initialCase.id));
  const [elapsed, setElapsed] = useState(0);
  const [bottomTab, setBottomTab] = useState<"node" | "log">("node");
  const [learningNode, setLearningNode] = useState<string | null>(null);
  const [manualInterpretation, setManualInterpretation] = useState<ManualInterpretationState>({
    fileName: "",
    status: "idle"
  });
  const [records, setRecords] = useState<OperationRecord[]>(() => [
    {
      id: "initial",
      time: nowLabel(),
      action: "进入实验",
      result: `加载${initialCase.shortTitle}动态逻辑图。`
    }
  ]);
  const [activeNode, setActiveNode] = useState<string>("stageAction");
  const lastSnapshot = useRef<LogicSnapshot | null>(null);
  const manualUploadVersion = useRef(0);
  const wasPermitted = useRef(false);

  const selectedCase = initialCase;
  const isCaseAvailable = selectedCase.status === "available";
  const snapshot = useMemo(() => calculateProtectionLogic(experiment, elapsed), [elapsed, experiment]);
  const learningMaterial = useMemo(
    () => (learningNode ? getNodeLearningMaterial(learningNode, experiment, snapshot, elapsed) : null),
    [elapsed, experiment, learningNode, snapshot]
  );
  const activeDelaySetting =
    experiment.logicType === "reclosingCharge" ? experiment.chargeDelaySetting : experiment.delaySetting;
  const flowStage = getFlowStage(experiment.testerOutputRunning, elapsed, snapshot.stageAction);
  const protectionStatus = !isCaseAvailable
    ? "待接入"
    : snapshot.stageAction
    ? "已动作"
    : experiment.testerOutputRunning && snapshot.actionPermitted
      ? "延时中"
      : experiment.testerOutputRunning
        ? "推演中"
        : snapshot.actionPermitted
          ? "待推演"
          : "未动作";

  useEffect(() => {
    if (!experiment.testerOutputRunning) return;

    const timer = window.setInterval(() => {
      setElapsed((current) => {
        const next = Number((current + 0.1).toFixed(1));
        if (next >= experiment.testerDuration) {
          setExperiment((state) => ({ ...state, testerOutputRunning: false }));
          addRecord(
            "停止推演",
            "动态推演",
            "运行",
            "停止",
            experiment.testerDuration < activeDelaySetting
              ? "故障量持续时间不足，保护启动后尚未完成延时便复归。"
              : "达到设定故障量持续时间，推演自动停止。"
          );
        }
        return next;
      });
    }, 100);

    return () => window.clearInterval(timer);
  }, [activeDelaySetting, experiment.testerDuration, experiment.testerOutputRunning]);

  useEffect(() => {
    if (experiment.testerOutputRunning && !snapshot.actionPermitted && wasPermitted.current) {
      addRecord("延时复归", "动作允许条件", "1", "0", "动作允许条件变为0，延时立即停止并归零。");
      setElapsed(0);
    }
    if (experiment.testerOutputRunning && snapshot.actionPermitted && !wasPermitted.current) {
      addRecord("延时开始", "最终动作允许", "0", "1", "零序Ⅲ段投入与启动均为1，开始累计动作时间。");
    }
    if (experiment.testerOutputRunning && snapshot.stageStarted && !lastSnapshot.current?.stageStarted) {
      addRecord("保护启动", "零序Ⅲ段启动", "0", "1", "电流回路接线、测试仪故障量设置和电流判据均满足。");
    }
    if (snapshot.stageAction && !lastSnapshot.current?.stageAction) {
      addRecord("保护动作", "零序Ⅲ段动作", "0", "1", "延时达到定值，动作节点输出1。");
    }
    wasPermitted.current = snapshot.actionPermitted;
    lastSnapshot.current = snapshot;
  }, [experiment.testerOutputRunning, snapshot]);

  function addRecord(
    action: string,
    target: string,
    before: string | undefined,
    after: string | undefined,
    result: string
  ) {
    setRecords((current) =>
      [
        {
          id: `${Date.now()}-${Math.random()}`,
          time: nowLabel(),
          action,
          before: before ? `${target}：${before}` : undefined,
          after: after ? `${target}：${after}` : undefined,
          result
        },
        ...current
      ].slice(0, 80)
    );
  }

  function updateField<K extends keyof ExperimentState>(
    key: K,
    value: ExperimentState[K],
    label: string,
    formatter: (value: ExperimentState[K]) => string = String
  ) {
    const before = formatter(experiment[key]);
    const after = formatter(value);
    setExperiment((state) => ({ ...state, [key]: value }));
    if (key !== "testerOutputRunning") setElapsed(0);
    addRecord("修改" + label, label, before, after, "逻辑图已按新条件重新计算。");
  }

  function applyPreset(preset: ScenarioPreset) {
    if (!isCaseAvailable) return;
    setExperiment({
      ...createInitialState(selectedCase.id),
      ...preset.patch
    });
    setElapsed(0);
    wasPermitted.current = false;
    lastSnapshot.current = null;
    addRecord("载入典型场景", "场景", undefined, preset.label, preset.description);
  }

  function startExperiment() {
    if (!isCaseAvailable) return;
    setElapsed(0);
    wasPermitted.current = false;
    lastSnapshot.current = null;
    setExperiment((state) => ({ ...state, testerOutputRunning: true }));
    addRecord("开始推演", "动态推演", "停止", "运行", "开始执行动态延时过程。");
  }

  function stopExperiment() {
    if (!isCaseAvailable) return;
    setExperiment((state) => ({ ...state, testerOutputRunning: false }));
    setElapsed(0);
    wasPermitted.current = false;
    lastSnapshot.current = null;
    addRecord("停止推演", "动态推演", "运行", "停止", "人工停止推演，延时计时清零。");
  }

  function resetAll() {
    setExperiment(isCaseAvailable ? createInitialState(selectedCase.id) : { ...createInitialState(), testerOutputRunning: false });
    setElapsed(0);
    setLearningNode(null);
    manualUploadVersion.current += 1;
    setManualInterpretation({ fileName: "", status: "idle" });
    wasPermitted.current = false;
    lastSnapshot.current = null;
    addRecord("复位", "实验状态", undefined, undefined, "已恢复当前模式默认参数，并清空说明书解读结果。");
  }

  function handleManualUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const uploadVersion = manualUploadVersion.current + 1;
    manualUploadVersion.current = uploadVersion;
    setManualInterpretation({ fileName: file.name, status: "analyzing" });
    addRecord("上传说明书", "AI解读", undefined, file.name, "正在按案例一模板识别保护说明书关键依据。");
    window.setTimeout(() => {
      if (manualUploadVersion.current !== uploadVersion) return;
      setManualInterpretation({ fileName: file.name, status: "ready" });
      addRecord("完成说明书解读", "AI解读", "解读中", "已完成", "已提取零序过流保护Ⅲ段的说明书页码、投入条件、启动条件和动作说明。");
    }, 900);
    event.target.value = "";
  }

  function focusNode(nodeId: string) {
    setActiveNode(nodeId);
    if (experiment.logicType === "zeroSequenceStageThree") {
      setLearningNode(nodeId);
    }
  }

  return (
    <main className="app-shell logic-trainer-shell">
      <header className="topbar">
        <div className="brand-mark">继保</div>
        <div>
          <p className="eyebrow">根据故障现象定位保护逻辑节点并完成排查验证</p>
          <h1>故障排查智能引导</h1>
          <span className="logic-case-pill">{selectedCase.shortTitle}</span>
        </div>
        <div className="logic-top-status">
          <span>当前状态</span>
          <strong>{protectionStatus}</strong>
        </div>
        <div className="logic-top-actions">
          <button className="topbar-link" type="button" onClick={resetAll}>
            复位
          </button>
          <Link className="topbar-link" href="/diagnosis">
            返回排查入口
          </Link>
        </div>
      </header>

      <section className="logic-workspace">
        <ControlPanel
          experiment={experiment}
          onUpdate={updateField}
          protectionCase={selectedCase}
          onPreset={applyPreset}
          presets={selectedCase.presets}
          onStart={startExperiment}
          onStop={stopExperiment}
          onReset={resetAll}
          disabled={!isCaseAvailable}
        />

        <div className="logic-main-column">
          <section className="logic-canvas-panel">
            <div className="logic-panel-head">
              <div>
                <span>动态逻辑图</span>
                <h2>{selectedCase.title}</h2>
              </div>
              <div className="timer-readout">
                <span>{isCaseAvailable ? "延时计时" : "案例状态"}</span>
                <strong>{isCaseAvailable ? `${formatNumber(elapsed)}s / ${formatNumber(activeDelaySetting)}s` : "待接入"}</strong>
              </div>
            </div>
            {isCaseAvailable ? (
              <DiagramViewport
                height={
                  selectedCase.logicType === "distanceStageTwo" ||
                  selectedCase.logicType === "reclosingCharge" ||
                  selectedCase.logicType === "overcurrentStageOne"
                    ? 700
                    : 560
                }
                width={
                  selectedCase.logicType === "zeroSequenceStageThree"
                    ? 1320
                    : selectedCase.logicType === "distanceStageTwo"
                      ? 1880
                      : selectedCase.logicType === "reclosingCharge"
                        ? 1780
                        : selectedCase.logicType === "overcurrentStageOne"
                          ? 2060
                          : 1680
                }
              >
                <LogicDiagram
                  activeNode={activeNode}
                  elapsed={elapsed}
                  flowStage={flowStage}
                  experiment={experiment}
                  snapshot={snapshot}
                  onNodeFocus={focusNode}
                />
              </DiagramViewport>
            ) : (
              <CaseFlowPlaceholder protectionCase={selectedCase} />
            )}
          </section>

          {isCaseAvailable ? (
            <BottomInsightPanel
              activeTab={bottomTab}
              elapsed={elapsed}
              experiment={experiment}
              onTabChange={setBottomTab}
              records={records}
              snapshot={snapshot}
              activeNode={activeNode}
            />
          ) : null}
        </div>

        <aside className="logic-side-panel">
          {isCaseAvailable ? (
            <>
              <ManualInterpretationPanel
                experiment={experiment}
                interpretation={manualInterpretation}
                onUpload={handleManualUpload}
                snapshot={snapshot}
              />
              <StatusAnalysis snapshot={snapshot} experiment={experiment} elapsed={elapsed} />
              <LogicExplanation snapshot={snapshot} experiment={experiment} />
            </>
          ) : (
            <ReservedCaseDetail protectionCase={selectedCase} />
          )}
        </aside>
      </section>
      {learningMaterial ? (
        <NodeLearningModal material={learningMaterial} onClose={() => setLearningNode(null)} />
      ) : null}
    </main>
  );
}

function getNodeLearningMaterial(
  nodeId: string,
  experiment: ExperimentState,
  snapshot: LogicSnapshot,
  elapsed: number
): NodeLearningMaterial | null {
  if (experiment.logicType !== "zeroSequenceStageThree") return null;

  const boolStatus = (value: boolean, onText = "输出 1", offText = "输出 0") =>
    value ? onText : offText;
  const nodeState = snapshot.nodes[nodeId as keyof LogicSnapshot["nodes"]];
  const fallbackValue = nodeState?.value ?? snapshot.stageAction;

  const sharedImages = {
    hard: {
      alt: "零序过流保护硬压板现场照片",
      caption: "现场硬压板 1KLP5：零序过流保护投入",
      src: "/diagnosis/zero-sequence/hard-plate.png"
    },
    hardLocation: {
      alt: "零序过流保护硬压板图纸位置",
      caption: "图纸中硬压板端子位置与编号标注",
      src: "/diagnosis/zero-sequence/hard-plate-location.png"
    },
    soft: {
      alt: "零序过流保护软压板设置照片",
      caption: "装置功能压板：零序过流保护软压板=1-投入",
      src: "/diagnosis/zero-sequence/soft-plate.png"
    },
    control: {
      alt: "零序电流保护控制字设置照片",
      caption: "保护定值控制字：零序电流保护=1-投入",
      src: "/diagnosis/zero-sequence/control-word.png"
    }
  } satisfies Record<string, NodeLearningImage>;

  const materials: Record<string, NodeLearningMaterial> = {
    hard: {
      title: "零序电流保护硬压板投入",
      subtitle: "现场物理压板确认",
      value: experiment.zeroSequenceHardPlate,
      statusText: boolStatus(experiment.zeroSequenceHardPlate, "已投入，输出 1", "未投入，输出 0"),
      summary: "硬压板是保护出口前的现场物理投入条件。只有硬压板处于投入位置，零序Ⅲ段投入支路才允许继续向后传递。",
      images: [sharedImages.hard, sharedImages.hardLocation],
      steps: [
        "在屏柜上找到 1KLP5“零序过流保护投入”硬压板。",
        "确认压板已可靠投入，避免只在装置菜单投入而现场出口被切断。",
        "本节点投入时记为 1，退出或接触不到位时记为 0。"
      ],
      currentBasis: `当前硬压板状态：${experiment.zeroSequenceHardPlate ? "投入" : "退出"}。`
    },
    soft: {
      title: "零序电流保护软压板投入",
      subtitle: "装置功能压板确认",
      value: experiment.zeroSequenceSoftPlate,
      statusText: boolStatus(experiment.zeroSequenceSoftPlate, "已投入，输出 1", "未投入，输出 0"),
      summary: "软压板是装置内部功能投入条件。老师素材中对应“功能压板-保护功能软压板”页面的“零序过流保护软压板=1-投入”。",
      images: [sharedImages.soft],
      steps: [
        "进入装置菜单的功能压板页面。",
        "找到“零序过流保护软压板”。",
        "确认其值为 1-投入；若为 0-退出，本节点输出 0，后级投入条件不成立。"
      ],
      currentBasis: `当前软压板状态：${experiment.zeroSequenceSoftPlate ? "投入" : "退出"}。`
    },
    control: {
      title: "零序电流保护Ⅲ段控制字投入",
      subtitle: "保护定值控制字确认",
      value: experiment.stageThreeControlWord,
      statusText: boolStatus(experiment.stageThreeControlWord, "已投入，输出 1", "未投入，输出 0"),
      summary: "控制字决定零序电流保护功能是否参与逻辑。老师素材中“零序电流保护=1-投入”，是零序过流保护Ⅲ段投入链路的关键条件。",
      images: [sharedImages.control],
      steps: [
        "进入保护定值的控制字页面。",
        "定位“零序电流保护”控制字。",
        "确认值为 1-投入；若为 0-退出，即使压板投入，零序Ⅲ段也不能进入后续启动逻辑。"
      ],
      currentBasis: `当前控制字状态：${experiment.stageThreeControlWord ? "投入" : "退出"}。`
    },
    enableAnd: {
      title: "投入条件 AND 门",
      subtitle: "硬压板、软压板、控制字共同判定",
      value: snapshot.stageEnabled,
      statusText: boolStatus(snapshot.stageEnabled),
      summary: "该 AND 门汇总三个投入条件：硬压板、软压板、Ⅲ段控制字。三者均为 1 时，零序Ⅲ段投入节点输出 1。",
      images: [sharedImages.hard, sharedImages.soft, sharedImages.control],
      steps: [
        "检查硬压板是否投入。",
        "检查软压板是否投入。",
        "检查零序电流保护控制字是否投入。三项同时满足后，投入支路成立。"
      ],
      currentBasis: `硬压板=${experiment.zeroSequenceHardPlate ? 1 : 0}，软压板=${experiment.zeroSequenceSoftPlate ? 1 : 0}，控制字=${experiment.stageThreeControlWord ? 1 : 0}。`
    },
    stageEnabled: {
      title: "零序Ⅲ段投入",
      subtitle: "投入支路输出",
      value: snapshot.stageEnabled,
      statusText: boolStatus(snapshot.stageEnabled),
      textbook: {
        source: "装置说明书 P23",
        text: "本装置设有零序Ⅱ段和零序Ⅲ段两段定时限保护；两段定时限功能均受对应保护软压板和零序保护控制字控制。"
      },
      summary: "该节点表示零序过流保护Ⅲ段已经具备投入条件，是后续最终动作允许的上支路输入。",
      images: [sharedImages.hard, sharedImages.soft, sharedImages.control],
      steps: [
        "确认硬压板、软压板、控制字均投入。",
        "三项投入条件均满足时，该节点输出 1。",
        "若任一条件为 0，最终动作允许不会成立。"
      ],
      currentBasis: snapshot.nodes.stageEnabled.reason
    },
    circuit: {
      title: "电流回路接线正确",
      subtitle: "试验接线条件",
      value: snapshot.currentCircuitCorrect,
      statusText: boolStatus(snapshot.currentCircuitCorrect, "接线正确，输出 1", "接线异常，输出 0"),
      summary: "该节点用于确认测试仪输出电流能够正确进入保护装置采样回路。接线异常时，即使电流数值设置满足，启动链路也不能成立。",
      images: [],
      steps: [
        "确认测试仪电流输出端子与保护装置电流输入端子对应。",
        "检查极性、相别和零序电流接线是否正确。",
        "确认接线正确后，本节点输出 1。"
      ],
      currentBasis: `当前电流回路状态：${currentCircuitLabels[experiment.currentCircuitState]}。`
    },
    tester: {
      title: "测试仪故障量设置正确",
      subtitle: "故障量配置条件",
      value: snapshot.testerFaultSettingCorrect,
      statusText: boolStatus(snapshot.testerFaultSettingCorrect, "设置正确，输出 1", "设置异常，输出 0"),
      summary: "该节点表示测试仪已按零序Ⅲ段试验要求输出对应故障量。它是启动支路的基础条件之一。",
      images: [],
      steps: [
        "确认测试仪选择正确的故障类型和输出通道。",
        "确认零序电流幅值、持续时间和试验状态满足本案例要求。",
        "设置正确时，本节点输出 1。"
      ],
      currentBasis: `当前测试仪故障量设置：${experiment.testerFaultSettingCorrect ? "正确" : "不正确"}。`
    },
    startAnd: {
      title: "启动条件 AND 门",
      subtitle: "接线、故障量、判据共同判定",
      value: snapshot.stageStarted,
      statusText: boolStatus(snapshot.stageStarted),
      summary: "该 AND 门汇总启动支路条件。电流回路、测试仪故障量和电流比较判据均满足时，零序Ⅲ段启动输出 1。",
      images: [],
      steps: [
        "确认电流回路接线正确。",
        "确认测试仪故障量设置正确。",
        "确认实际零序电流 3I₀ 大于动作电流定值 I₀.setⅢ。"
      ],
      currentBasis: snapshot.nodes.stageStarted.reason
    },
    current: {
      title: "3I₀ > I₀.setⅢ 电流判据",
      subtitle: "零序电流与动作定值比较",
      value: snapshot.currentCriterion,
      statusText: boolStatus(snapshot.currentCriterion, "判据满足，输出 1", "判据不满足，输出 0"),
      summary: "该节点将实际零序电流 3I₀ 与零序Ⅲ段动作电流定值 I₀.setⅢ 比较；满足 3I₀ > I₀.setⅢ 时输出 1，否则输出 0。",
      images: [],
      steps: [
        "读取测试仪输出零序电流并换算为实际 3I₀。",
        "读取零序Ⅲ段动作电流定值 I₀.setⅢ。",
        "采用严格大于判据：3I₀ > I₀.setⅢ。相等时不动作。"
      ],
      currentBasis: `当前：3I₀=${formatNumber(snapshot.actual3I0)}A，I₀.setⅢ=${formatNumber(experiment.currentSetting)}A。`
    },
    started: {
      title: "零序Ⅲ段启动",
      subtitle: "启动支路输出",
      value: snapshot.stageStarted,
      statusText: boolStatus(snapshot.stageStarted),
      textbook: {
        source: "装置说明书 P23",
        text: "零序Ⅱ段保护固定带方向，零序Ⅲ段可通过控制字选择是否带方向；发生 PT 断线后，零序Ⅲ段保护自动退出，或按控制选择自动不带方向。"
      },
      summary: "启动节点输出 1 后，表示零序Ⅲ段已经满足启动条件，等待与投入支路共同形成最终动作允许。",
      images: [],
      steps: [
        "确认基础试验条件输出 1。",
        "确认电流判据输出 1。",
        "两类条件都成立后，启动节点输出 1。"
      ],
      currentBasis: snapshot.nodes.stageStarted.reason
    },
    permitted: {
      title: "最终动作允许 AND 门",
      subtitle: "投入支路与启动支路共同判定",
      value: snapshot.actionPermitted,
      statusText: boolStatus(snapshot.actionPermitted),
      summary: "最终动作允许需要“零序Ⅲ段投入”和“零序Ⅲ段启动”同时为 1。该节点为 1 后，动作延时开始累计。",
      images: [],
      steps: [
        "检查零序Ⅲ段投入是否为 1。",
        "检查零序Ⅲ段启动是否为 1。",
        "二者均满足时，进入 tⅢ0.set 延时环节。"
      ],
      currentBasis: snapshot.nodes.actionPermitted.reason
    },
    delay: {
      title: "tⅢ0.set 动作延时",
      subtitle: "动作时间定值累计",
      value: snapshot.nodes.delay.value,
      statusText: boolStatus(snapshot.nodes.delay.value, "延时完成，输出 1", "延时未完成，输出 0"),
      textbook: {
        source: "装置说明书 P24",
        text: "非全相运行期间零序Ⅲ段动作时间比整定时间缩短 0.5s；若整定值小于 0.5s，则动作时间按整定值执行。"
      },
      summary: "当最终动作允许为 1 后，保护开始累计动作延时。累计时间达到 tⅢ0.set 后，延时节点输出 1。",
      images: [],
      steps: [
        "最终动作允许为 1 后开始计时。",
        "故障量持续期间保持计时。",
        "达到动作时间定值后输出 1；中途条件消失则延时复归。"
      ],
      currentBasis: `当前计时：${formatNumber(elapsed)}s / ${formatNumber(experiment.delaySetting)}s。`
    },
    stageAction: {
      title: "零序Ⅲ段动作",
      subtitle: "最终动作输出",
      value: snapshot.stageAction,
      statusText: boolStatus(snapshot.stageAction, "已动作，输出 1", "未动作，输出 0"),
      textbook: {
        source: "装置说明书 P24",
        text: "零序Ⅲ段动作后三跳并闭锁重合闸；是否闭锁重合闸由“Ⅱ段保护闭锁重合闸”控制字选择。"
      },
      summary: "最终动作节点表示零序过流保护Ⅲ段动作结果。只有投入、启动和延时均满足后，该节点才输出 1。",
      images: [],
      steps: [
        "确认零序Ⅲ段投入支路成立。",
        "确认零序Ⅲ段启动支路成立。",
        "确认动作延时完成，最终动作节点输出 1。"
      ],
      currentBasis: snapshot.nodes.stageAction.reason
    }
  };

  return (
    materials[nodeId] ?? {
      title: nodeState?.label ?? "零序Ⅲ段逻辑节点",
      subtitle: "实时节点说明",
      value: fallbackValue,
      statusText: boolStatus(fallbackValue),
      summary: nodeState?.reason ?? "该节点用于展示当前零序Ⅲ段逻辑计算结果。",
      images: [],
      steps: ["查看当前节点输出值。", "结合右侧状态和下方节点说明判断上游条件。"],
      currentBasis: nodeState?.reason ?? "当前暂无更详细的节点资料。"
    }
  );
}

function DiagramViewport({ children, width = 1320, height = 560 }: { children: ReactNode; width?: number; height?: number }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const dragState = useRef({
    active: false,
    left: 0,
    top: 0,
    x: 0,
    y: 0
  });

  function handleMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    dragState.current = {
      active: true,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
      x: event.clientX,
      y: event.clientY
    };
    viewport.classList.add("dragging");
  }

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport || !dragState.current.active) return;
    viewport.scrollLeft = dragState.current.left - (event.clientX - dragState.current.x);
    viewport.scrollTop = dragState.current.top - (event.clientY - dragState.current.y);
  }

  function stopDragging() {
    dragState.current.active = false;
    viewportRef.current?.classList.remove("dragging");
  }

  function updateZoom(nextZoom: number, origin?: { x: number; y: number }) {
    const viewport = viewportRef.current;
    const clampedZoom = Math.min(1.8, Math.max(0.75, Number(nextZoom.toFixed(2))));
    if (!viewport) {
      setZoom(clampedZoom);
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const originX = origin ? origin.x - rect.left : viewport.clientWidth / 2;
    const originY = origin ? origin.y - rect.top : viewport.clientHeight / 2;
    const centerX = viewport.scrollLeft + originX;
    const centerY = viewport.scrollTop + originY;
    const ratio = clampedZoom / zoom;
    setZoom(clampedZoom);

    window.requestAnimationFrame(() => {
      viewport.scrollLeft = centerX * ratio - originX;
      viewport.scrollTop = centerY * ratio - originY;
    });
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const step = event.deltaY > 0 ? -0.08 : 0.08;
    updateZoom(zoom + step, { x: event.clientX, y: event.clientY });
  }

  return (
    <div className="diagram-viewer">
      <div className="diagram-tools" aria-label="图纸缩放控制">
        <button type="button" onClick={() => updateZoom(zoom - 0.15)}>−</button>
        <strong>{Math.round(zoom * 100)}%</strong>
        <button type="button" onClick={() => updateZoom(zoom + 0.15)}>＋</button>
        <button type="button" onClick={() => updateZoom(1)}>重置</button>
      </div>
      <div
        className="diagram-viewport"
        onMouseDown={handleMouseDown}
        onMouseLeave={stopDragging}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onWheel={handleWheel}
        ref={viewportRef}
      >
        <div className="diagram-stage" style={{ height: height * zoom + 28, width: width * zoom + 28 }}>
          <div className="diagram-scale-layer" style={{ height, transform: `scale(${zoom})`, width }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlPanel({
  experiment,
  onUpdate,
  protectionCase,
  onPreset,
  presets,
  onStart,
  onStop,
  onReset,
  disabled
}: {
  experiment: ExperimentState;
  onUpdate: <K extends keyof ExperimentState>(
    key: K,
    value: ExperimentState[K],
    label: string,
    formatter?: (value: ExperimentState[K]) => string
  ) => void;
  protectionCase: ProtectionCase;
  onPreset: (preset: ScenarioPreset) => void;
  presets: ScenarioPreset[];
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  disabled: boolean;
}) {
  const logicType = protectionCase.logicType;

  function renderCaseControls() {
    if (logicType === "distanceStageTwo") {
      return (
        <>
          <PanelBlock title="保护投入条件">
            <ToggleRow label="距离保护硬压板" value={experiment.distanceHardPlate} onChange={(value) => onUpdate("distanceHardPlate", value, "距离保护硬压板", boolText)} />
            <ToggleRow label="接地距离保护软压板" value={experiment.distanceSoftPlate} onChange={(value) => onUpdate("distanceSoftPlate", value, "接地距离保护软压板", boolText)} />
            <ToggleRow label="接地距离Ⅱ段控制字" value={experiment.distanceStageTwoControlWord} onChange={(value) => onUpdate("distanceStageTwoControlWord", value, "接地距离Ⅱ段控制字", boolText)} />
          </PanelBlock>
          <PanelBlock title="启动条件">
            <label className="field-row">
              <span>电流回路接线正确</span>
              <select value={experiment.currentCircuitState} onChange={(event) => onUpdate("currentCircuitState", event.target.value as ExperimentState["currentCircuitState"], "电流回路状态", (value) => currentCircuitLabels[value])}>
                <option value="normal">正常</option>
                <option value="open">开路</option>
                <option value="wrongTerminal">端子接错</option>
              </select>
            </label>
            <ToggleRow label="电压回路接线正确" value={experiment.voltageCircuitCorrect} onChange={(value) => onUpdate("voltageCircuitCorrect", value, "电压回路接线正确", (item) => (item ? "正确" : "不正确"))} />
            <ToggleRow label="故障前状态设置正确" value={experiment.preFaultStateCorrect} onChange={(value) => onUpdate("preFaultStateCorrect", value, "故障前状态设置正确", (item) => (item ? "正确" : "不正确"))} />
            <ToggleRow label="阻抗故障量设置正确" value={experiment.impedanceFaultSettingCorrect} onChange={(value) => onUpdate("impedanceFaultSettingCorrect", value, "阻抗故障量设置正确", (item) => (item ? "正确" : "不正确"))} />
            <ToggleRow label="TV断线复归" value={experiment.tvResetDone} onChange={(value) => onUpdate("tvResetDone", value, "TV断线复归", (item) => (item ? "已复归" : "未复归"))} />
          </PanelBlock>
          <PanelBlock title="阻抗与延时">
            <NumberField label="测量阻抗 Z/Ω" value={experiment.impedanceValue} min={0} step={0.1} onChange={(value) => onUpdate("impedanceValue", value, "测量阻抗Z")} />
            <NumberField label="阻抗定值 ZsetⅡ/Ω" value={experiment.impedanceSetting} min={0.1} step={0.1} onChange={(value) => onUpdate("impedanceSetting", value, "接地距离Ⅱ段阻抗定值")} />
            <NumberField label="动作时间 tⅡ.set/s" value={experiment.delaySetting} min={0.1} step={0.1} onChange={(value) => onUpdate("delaySetting", value, "接地距离Ⅱ段动作时间定值")} />
            <NumberField label="故障量持续时间/s" value={experiment.testerDuration} min={0.1} step={0.1} onChange={(value) => onUpdate("testerDuration", value, "测试仪故障量持续时间")} />
          </PanelBlock>
        </>
      );
    }

    if (logicType === "reclosingCharge") {
      return (
        <>
          <PanelBlock title="充电投入条件">
            <ToggleRow label="重合闸硬压板" value={experiment.reclosingHardPlate} onChange={(value) => onUpdate("reclosingHardPlate", value, "重合闸硬压板", boolText)} />
            <ToggleRow label="重合闸软压板" value={experiment.reclosingSoftPlate} onChange={(value) => onUpdate("reclosingSoftPlate", value, "重合闸软压板", boolText)} />
            <ToggleRow label="停用重合闸控制字=0" value={experiment.reclosingStopControlOff} onChange={(value) => onUpdate("reclosingStopControlOff", value, "停用重合闸控制字", (item) => (item ? "0" : "1"))} />
            <ToggleRow label="禁用重合闸控制字=0" value={experiment.reclosingBanControlOff} onChange={(value) => onUpdate("reclosingBanControlOff", value, "禁用重合闸控制字", (item) => (item ? "0" : "1"))} />
            <ToggleRow label="无外部闭锁重合闸信号" value={experiment.noExternalBlockSignal} onChange={(value) => onUpdate("noExternalBlockSignal", value, "外部闭锁重合闸信号", (item) => (item ? "无闭锁" : "有闭锁"))} />
          </PanelBlock>
          <PanelBlock title="运行状态条件">
            <ToggleRow label="保护未启动" value={experiment.protectionNotStarted} onChange={(value) => onUpdate("protectionNotStarted", value, "保护启动状态", (item) => (item ? "未启动" : "已启动"))} />
            <ToggleRow label="断路器合位" value={experiment.breakerClosed} onChange={(value) => onUpdate("breakerClosed", value, "断路器合位", (item) => (item ? "合位" : "分位"))} />
          </PanelBlock>
          <PanelBlock title="充电延时">
            <NumberField label="充电时间 tTVDX/s" value={experiment.chargeDelaySetting} min={1} step={1} onChange={(value) => onUpdate("chargeDelaySetting", value, "重合闸充电时间")} />
            <NumberField label="观察持续时间/s" value={experiment.testerDuration} min={1} step={1} onChange={(value) => onUpdate("testerDuration", value, "观察持续时间")} />
          </PanelBlock>
        </>
      );
    }

    if (logicType === "overcurrentStageOne") {
      return (
        <>
          <PanelBlock title="保护投入条件">
            <ToggleRow label="过流Ⅰ段硬压板" value={experiment.overcurrentHardPlate} onChange={(value) => onUpdate("overcurrentHardPlate", value, "过流Ⅰ段硬压板", boolText)} />
            <ToggleRow label="过流Ⅰ段软压板" value={experiment.overcurrentSoftPlate} onChange={(value) => onUpdate("overcurrentSoftPlate", value, "过流Ⅰ段软压板", boolText)} />
          </PanelBlock>
          <PanelBlock title="启动闭锁条件">
            <label className="field-row">
              <span>电流回路接线正确</span>
              <select value={experiment.currentCircuitState} onChange={(event) => onUpdate("currentCircuitState", event.target.value as ExperimentState["currentCircuitState"], "电流回路状态", (value) => currentCircuitLabels[value])}>
                <option value="normal">正常</option>
                <option value="open">开路</option>
                <option value="wrongTerminal">端子接错</option>
              </select>
            </label>
            <ToggleRow label="故障量方向满足" value={experiment.overcurrentDirectionSatisfied} onChange={(value) => onUpdate("overcurrentDirectionSatisfied", value, "故障量方向满足", (item) => (item ? "满足" : "不满足"))} />
            <ToggleRow label="故障量电压满足" value={experiment.overcurrentVoltageSatisfied} onChange={(value) => onUpdate("overcurrentVoltageSatisfied", value, "故障量电压满足", (item) => (item ? "满足" : "不满足"))} />
            <ToggleRow label="方向控制字=1" value={experiment.overcurrentDirectionalControl} onChange={(value) => onUpdate("overcurrentDirectionalControl", value, "过流Ⅰ段带方向控制字", (item) => (item ? "1" : "0"))} />
            <ToggleRow label="低压闭锁控制字=1" value={experiment.overcurrentLowVoltageBlockControl} onChange={(value) => onUpdate("overcurrentLowVoltageBlockControl", value, "过流Ⅰ段低压闭锁控制字", (item) => (item ? "1" : "0"))} />
            <ToggleRow label="电压回路接线正确" value={experiment.voltageCircuitCorrect} onChange={(value) => onUpdate("voltageCircuitCorrect", value, "电压回路接线正确", (item) => (item ? "正确" : "不正确"))} />
            <ToggleRow label="故障前状态设置正确" value={experiment.preFaultStateCorrect} onChange={(value) => onUpdate("preFaultStateCorrect", value, "故障前状态设置正确", (item) => (item ? "正确" : "不正确"))} />
            <ToggleRow label="PT断线退出" value={experiment.ptTripReturned} onChange={(value) => onUpdate("ptTripReturned", value, "PT断线退出", (item) => (item ? "已退出" : "未退出"))} />
          </PanelBlock>
          <PanelBlock title="电流与延时">
            <NumberField label="实际相电流 I/A" value={experiment.phaseCurrent} min={0} step={0.1} onChange={(value) => onUpdate("phaseCurrent", value, "实际相电流I")} />
            <NumberField label="动作电流定值 Iset/A" value={experiment.phaseCurrentSetting} min={0.1} step={0.1} onChange={(value) => onUpdate("phaseCurrentSetting", value, "过流Ⅰ段动作电流定值")} />
            <NumberField label="动作时间 tⅠ.set/s" value={experiment.delaySetting} min={0.1} step={0.1} onChange={(value) => onUpdate("delaySetting", value, "过流Ⅰ段动作时间定值")} />
            <NumberField label="故障量持续时间/s" value={experiment.testerDuration} min={0.1} step={0.1} onChange={(value) => onUpdate("testerDuration", value, "测试仪故障量持续时间")} />
          </PanelBlock>
        </>
      );
    }

    return (
      <>
        <PanelBlock title="保护投入条件">
          <ToggleRow
            label="零序电流保护硬压板"
            value={experiment.zeroSequenceHardPlate}
            onChange={(value) => onUpdate("zeroSequenceHardPlate", value, "零序电流保护硬压板", boolText)}
          />
          <ToggleRow
            label="零序电流保护软压板"
            value={experiment.zeroSequenceSoftPlate}
            onChange={(value) => onUpdate("zeroSequenceSoftPlate", value, "零序电流保护软压板", boolText)}
          />
          <ToggleRow
            label="Ⅲ段控制字"
            value={experiment.stageThreeControlWord}
            onChange={(value) => onUpdate("stageThreeControlWord", value, "零序过流保护Ⅲ段控制字", boolText)}
          />
        </PanelBlock>

        <PanelBlock title="保护启动条件">
          <label className="field-row">
            <span>电流回路接线正确</span>
            <select
              value={experiment.currentCircuitState}
              onChange={(event) =>
                onUpdate(
                  "currentCircuitState",
                  event.target.value as ExperimentState["currentCircuitState"],
                  "电流回路状态",
                  (value) => currentCircuitLabels[value]
                )
              }
            >
              <option value="normal">正常</option>
              <option value="open">开路</option>
              <option value="wrongTerminal">端子接错</option>
            </select>
          </label>
          <ToggleRow
            label="测试仪故障量设置正确"
            value={experiment.testerFaultSettingCorrect}
            onChange={(value) => onUpdate("testerFaultSettingCorrect", value, "测试仪故障量设置正确", (item) => (item ? "正确" : "不正确"))}
          />
        </PanelBlock>

        <PanelBlock title="测试条件">
          <NumberField label="输出零序电流 3I0/A" value={experiment.testerCurrent} min={0} step={0.1} onChange={(value) => onUpdate("testerCurrent", value, "测试仪输出零序电流")} />
          <NumberField label="动作电流定值 I0.set/A" value={experiment.currentSetting} min={0.1} step={0.1} onChange={(value) => onUpdate("currentSetting", value, "零序Ⅲ段动作电流定值")} />
        </PanelBlock>

        <PanelBlock title="延时条件">
          <NumberField label="动作时间定值 t0.set/s" value={experiment.delaySetting} min={0.1} step={0.1} onChange={(value) => onUpdate("delaySetting", value, "零序Ⅲ段动作时间定值")} />
          <NumberField label="故障量持续时间/s" value={experiment.testerDuration} min={0.1} step={0.1} onChange={(value) => onUpdate("testerDuration", value, "测试仪故障量持续时间")} />
        </PanelBlock>
      </>
    );
  }

  if (disabled) {
    return (
      <aside className="logic-control-panel">
        <PanelBlock title="案例状态">
          <div className="control-placeholder">
            <strong>流程图待接入</strong>
            <p>老师提供该案例的图纸、输入条件、逻辑节点和定值规则后，这里会显示该案例自己的典型场景与推演控制。</p>
          </div>
        </PanelBlock>
      </aside>
    );
  }

  return (
    <aside className="logic-control-panel">
      <PanelBlock title="典型场景">
        <div className="preset-grid">
          {presets.map((preset) => (
            <button key={preset.id} type="button" onClick={() => onPreset(preset)}>
              <span>{preset.label}</span>
              <small>{preset.description}</small>
            </button>
          ))}
        </div>
      </PanelBlock>

      {renderCaseControls()}

      <div className="control-actions">
        <button className="primary-button compact" type="button" onClick={onStart}>开始推演</button>
        <button className="secondary-button compact" type="button" onClick={onStop}>停止推演</button>
        <button className="secondary-button compact" type="button" onClick={onReset}>复位</button>
      </div>
    </aside>
  );
}

function LogicDiagram({
  experiment,
  snapshot,
  elapsed,
  flowStage,
  activeNode,
  onNodeFocus
}: {
  experiment: ExperimentState;
  snapshot: LogicSnapshot;
  elapsed: number;
  flowStage: FlowStage;
  activeNode: string;
  onNodeFocus: (id: string) => void;
}) {
  if (experiment.logicType === "distanceStageTwo") {
    return (
      <DistanceStageTwoDiagram
        activeNode={activeNode}
        elapsed={elapsed}
        experiment={experiment}
        flowStage={flowStage}
        onNodeFocus={onNodeFocus}
        snapshot={snapshot}
      />
    );
  }

  if (experiment.logicType === "reclosingCharge") {
    return (
      <ReclosingChargeDiagram
        activeNode={activeNode}
        elapsed={elapsed}
        experiment={experiment}
        flowStage={flowStage}
        onNodeFocus={onNodeFocus}
        snapshot={snapshot}
      />
    );
  }

  if (experiment.logicType === "overcurrentStageOne") {
    return (
      <OvercurrentStageOneDiagram
        activeNode={activeNode}
        elapsed={elapsed}
        experiment={experiment}
        flowStage={flowStage}
        onNodeFocus={onNodeFocus}
        snapshot={snapshot}
      />
    );
  }

  const showEnable = stageReached(flowStage, "enable");
  const showStart = stageReached(flowStage, "start");
  const showPermit = stageReached(flowStage, "permit");
  const showDelay = stageReached(flowStage, "delay");
  const showAction = stageReached(flowStage, "action");
  const values: Record<string, boolean> = {
    hard: showEnable && experiment.zeroSequenceHardPlate,
    soft: showEnable && experiment.zeroSequenceSoftPlate,
    control: showEnable && experiment.stageThreeControlWord,
    stageEnabled: showEnable && snapshot.stageEnabled,
    circuit: showStart && snapshot.currentCircuitCorrect,
    tester: showStart && snapshot.testerFaultSettingCorrect,
    compare: showStart && snapshot.currentCriterion,
    started: showStart && snapshot.stageStarted,
    permitted: showPermit && snapshot.actionPermitted,
    delay: showDelay && snapshot.actionPermitted,
    stageAction: showAction && snapshot.stageAction
  };
  const rawValues = {
    hard: experiment.zeroSequenceHardPlate,
    soft: experiment.zeroSequenceSoftPlate,
    control: experiment.stageThreeControlWord,
    stageEnabled: snapshot.stageEnabled,
    circuit: snapshot.currentCircuitCorrect,
    tester: snapshot.testerFaultSettingCorrect,
    compare: snapshot.currentCriterion,
    started: snapshot.stageStarted,
    permitted: snapshot.actionPermitted,
    stageAction: snapshot.stageAction
  };
  const delayProgress = Math.min(1, experiment.delaySetting > 0 ? elapsed / experiment.delaySetting : 0);

  return (
    <svg className="logic-diagram original-style" preserveAspectRatio="xMidYMid meet" viewBox="0 0 1320 560" role="img" aria-label="零序过流保护Ⅲ段动作逻辑图">
      <defs>
        <marker id="arrowLogic" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
          <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
        </marker>
      </defs>

      <Wire path="M338 78 H390 V132 H430" active={values.hard} />
      <Wire path="M338 142 H430" active={values.soft} fault={showEnable && !rawValues.soft} />
      <Wire path="M338 206 H390 V154 H430" active={values.control} fault={showEnable && !rawValues.control} />
      <Wire path="M548 142 H590 V270 H630" active={values.stageEnabled} fault={showEnable && !rawValues.stageEnabled} />

      <Wire path="M250 364 H318" active={values.circuit} fault={showStart && !rawValues.circuit} />
      <Wire path="M250 430 H318" active={values.tester} fault={showStart && !rawValues.tester} />
      <Wire path="M438 398 H488" active={showStart && values.circuit && values.tester} fault={showStart && (!rawValues.circuit || !rawValues.tester)} />
      <Wire path="M646 398 H698" active={values.compare} fault={showStart && !rawValues.compare} />
      <Wire path="M836 398 H858 V332 H898" active={values.started} fault={showStart && !rawValues.started} />

      <Wire path="M770 302 H898" active={showPermit && rawValues.stageEnabled} fault={showPermit && !rawValues.stageEnabled} />
      <Wire path="M1018 318 H1068" active={values.permitted} fault={showPermit && !rawValues.permitted} />
      <Wire path="M1130 318 H1160" active={values.delay} timing={values.delay && !values.stageAction} />

      <ArrowNode id="hard" x={160} y={48} width={178} height={60} title="零序电流保护" detail="硬压板投入" value={values.hard} pending={!showEnable} activeNode={activeNode} onFocus={onNodeFocus} />
      <ArrowNode id="soft" x={160} y={112} width={178} height={60} title="零序电流保护" detail="软压板投入" value={values.soft} fault={showEnable && !rawValues.soft} pending={!showEnable} activeNode={activeNode} onFocus={onNodeFocus} />
      <ArrowNode id="control" x={160} y={176} width={178} height={60} title="零序电流保护(Ⅲ段)" detail="控制字投入" value={values.control} fault={showEnable && !rawValues.control} pending={!showEnable} activeNode={activeNode} onFocus={onNodeFocus} />
      <AndBlock id="enableAnd" x={430} y={66} width={118} height={150} value={values.stageEnabled} activeNode={activeNode} onFocus={onNodeFocus} />
      <ArrowNode id="stageEnabled" x={630} y={270} width={140} height={54} title="零序Ⅲ段投入" value={values.stageEnabled} fault={showEnable && !rawValues.stageEnabled} pending={!showEnable} activeNode={activeNode} onFocus={onNodeFocus} />

      <ArrowNode id="circuit" x={36} y={334} width={214} height={60} title="电流回路接线正确" value={values.circuit} fault={showStart && !rawValues.circuit} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <ArrowNode id="tester" x={36} y={400} width={214} height={60} title="测试仪故障量设置正确" value={values.tester} fault={showStart && !rawValues.tester} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <AndBlock id="startAnd" x={318} y={312} width={120} height={170} value={showStart && values.circuit && values.tester} activeNode={activeNode} onFocus={onNodeFocus} />
      <FormulaNode id="current" x={488} y={368} width={158} height={60} currentText={`当前：${formatNumber(snapshot.actual3I0)}A / ${formatNumber(experiment.currentSetting)}A`} value={values.compare} fault={showStart && !rawValues.compare} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <ArrowNode id="started" x={698} y={368} width={138} height={60} title="零序Ⅲ段启动" value={values.started} fault={showStart && !rawValues.started} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />

      <AndBlock id="permitted" x={898} y={266} width={120} height={172} value={values.permitted} activeNode={activeNode} onFocus={onNodeFocus} />
      <DelayNode
        activeNode={activeNode}
        elapsed={elapsed}
        progress={delayProgress}
        reached={showDelay}
        running={values.delay && !values.stageAction}
        setting={experiment.delaySetting}
        value={values.stageAction}
        onFocus={onNodeFocus}
      />
      <ArrowNode id="stageAction" x={1160} y={288} width={148} height={60} title="零序Ⅲ段动作" value={values.stageAction} action={values.stageAction} pending={!showAction} activeNode={activeNode} onFocus={onNodeFocus} />

      <ValueLabel x={390} y={91} value={values.hard} />
      <ValueLabel x={388} y={142} value={values.soft} />
      <ValueLabel x={390} y={193} value={values.control} />
      <ValueLabel x={584} y={142} value={values.stageEnabled} />
      <ValueLabel x={278} y={364} value={values.circuit} />
      <ValueLabel x={278} y={430} value={values.tester} />
      <ValueLabel x={462} y={398} value={showStart && values.circuit && values.tester} />
      <ValueLabel x={672} y={398} value={values.compare} />
      <ValueLabel x={858} y={398} value={values.started} />
      <ValueLabel x={796} y={302} value={showPermit && rawValues.stageEnabled} />
      <ValueLabel x={872} y={332} value={values.started} />
      <ValueLabel x={1044} y={318} value={values.permitted} />
    </svg>
  );
}

function DistanceStageTwoDiagram({
  activeNode,
  elapsed,
  experiment,
  flowStage,
  onNodeFocus,
  snapshot
}: {
  activeNode: string;
  elapsed: number;
  experiment: ExperimentState;
  flowStage: FlowStage;
  onNodeFocus: (id: string) => void;
  snapshot: LogicSnapshot;
}) {
  const showEnable = stageReached(flowStage, "enable");
  const showStart = stageReached(flowStage, "start");
  const showPermit = stageReached(flowStage, "permit");
  const showDelay = stageReached(flowStage, "delay");
  const showAction = stageReached(flowStage, "action");
  const tvPrep = showStart && experiment.voltageCircuitCorrect && experiment.preFaultStateCorrect;
  const tvResetPath = experiment.voltageCircuitCorrect && experiment.preFaultStateCorrect && experiment.tvResetDone;
  const middlePrep = showStart && snapshot.currentCircuitCorrect && experiment.impedanceFaultSettingCorrect && tvResetPath;
  const progress = Math.min(1, experiment.delaySetting > 0 ? elapsed / experiment.delaySetting : 0);

  return (
    <svg className="logic-diagram original-style" style={{ height: 700, width: 1880 }} preserveAspectRatio="xMidYMid meet" viewBox="0 0 1880 700" role="img" aria-label="接地距离保护Ⅱ段动作逻辑图">
      <Wire path="M850 138 H904 V183 H946" active={showEnable && experiment.distanceHardPlate} fault={showEnable && !experiment.distanceHardPlate} />
      <Wire path="M850 194 H946" active={showEnable && experiment.distanceSoftPlate} fault={showEnable && !experiment.distanceSoftPlate} />
      <Wire path="M850 250 H904 V206 H946" active={showEnable && experiment.distanceStageTwoControlWord} fault={showEnable && !experiment.distanceStageTwoControlWord} />
      <Wire path="M1080 194 H1116 V322 H1168" active={showEnable && snapshot.stageEnabled} fault={showEnable && !snapshot.stageEnabled} />

      <Wire path="M226 440 H278" active={showStart && experiment.voltageCircuitCorrect} fault={showStart && !experiment.voltageCircuitCorrect} />
      <Wire path="M226 520 H278" active={showStart && experiment.preFaultStateCorrect} fault={showStart && !experiment.preFaultStateCorrect} />
      <Wire path="M404 480 H456" active={tvPrep} fault={showStart && !tvPrep} />
      <Wire path="M520 480 H600 V590 H640" active={showStart && tvResetPath} fault={showStart && !tvResetPath} />

      <Wire path="M668 302 H750 V340 H828" active={showStart && snapshot.currentCircuitCorrect} fault={showStart && !snapshot.currentCircuitCorrect} />
      <Wire path="M668 374 H828" active={showStart && experiment.impedanceFaultSettingCorrect} fault={showStart && !experiment.impedanceFaultSettingCorrect} />
      <Wire path="M820 590 H750 V486 H828" active={showStart && tvResetPath} fault={showStart && !tvResetPath} />
      <Wire path="M970 400 H1030" active={middlePrep} fault={showStart && !middlePrep} />
      <Wire path="M1186 400 H1228" active={showStart && snapshot.currentCriterion} fault={showStart && !snapshot.currentCriterion} />
      <Wire path="M1390 400 H1406" active={showStart && snapshot.stageStarted} fault={showStart && !snapshot.stageStarted} />

      <Wire path="M1308 322 H1406" active={showPermit && snapshot.stageEnabled} fault={showPermit && !snapshot.stageEnabled} />
      <Wire path="M1528 336 H1582" active={showPermit && snapshot.actionPermitted} fault={showPermit && !snapshot.actionPermitted} />
      <Wire path="M1646 336 H1688" active={showDelay && snapshot.actionPermitted} timing={showDelay && snapshot.actionPermitted && !snapshot.stageAction} />

      <ArrowNode id="distanceHard" x={690} y={110} width={160} height={56} title="距离保护硬压板" detail="投入" value={showEnable && experiment.distanceHardPlate} fault={showEnable && !experiment.distanceHardPlate} pending={!showEnable} activeNode={activeNode} onFocus={onNodeFocus} />
      <ArrowNode id="distanceSoft" x={690} y={166} width={160} height={56} title="(接地)距离" detail="保护软压板投入" value={showEnable && experiment.distanceSoftPlate} fault={showEnable && !experiment.distanceSoftPlate} pending={!showEnable} activeNode={activeNode} onFocus={onNodeFocus} />
      <ArrowNode id="distanceControl" x={690} y={222} width={160} height={56} title="接地距离保护(Ⅱ" detail="段) 控制字投入" value={showEnable && experiment.distanceStageTwoControlWord} fault={showEnable && !experiment.distanceStageTwoControlWord} pending={!showEnable} activeNode={activeNode} onFocus={onNodeFocus} />
      <AndBlock id="enableAnd" x={946} y={120} width={134} height={146} value={showEnable && snapshot.stageEnabled} activeNode={activeNode} onFocus={onNodeFocus} />
      <ArrowNode id="stageEnabled" x={1168} y={294} width={140} height={56} title="接地距离Ⅱ段" detail="投入" value={showEnable && snapshot.stageEnabled} fault={showEnable && !snapshot.stageEnabled} pending={!showEnable} activeNode={activeNode} onFocus={onNodeFocus} />

      <ArrowNode id="voltageCircuit" x={36} y={412} width={190} height={56} title="电压回路接线正确" value={showStart && experiment.voltageCircuitCorrect} fault={showStart && !experiment.voltageCircuitCorrect} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <ArrowNode id="preFault" x={36} y={492} width={190} height={56} title="故障前状态设置正确" value={showStart && experiment.preFaultStateCorrect} fault={showStart && !experiment.preFaultStateCorrect} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <AndBlock id="tvPrepAnd" x={278} y={390} width={126} height={180} value={tvPrep} activeNode={activeNode} onFocus={onNodeFocus} />
      <VariableDelayNode id="tvResetDelay" activeNode={activeNode} elapsed={elapsed} progress={Math.min(1, elapsed / 15)} reached={showStart} running={tvPrep && !tvResetPath} settingLabel="tTVDX" value={showStart && tvResetPath} x={456} y={450} onFocus={onNodeFocus} />
      <text className="logic-annotation small" x="474" y="530">（一般</text>
      <text className="logic-annotation small" x="478" y="548">为15s）</text>
      <ArrowNode id="tvReset" x={640} y={562} width={180} height={56} title="TV断线复归" value={showStart && tvResetPath} fault={showStart && !tvResetPath} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />

      <ArrowNode id="circuit" x={486} y={274} width={182} height={56} title="电流回路接线正确" value={showStart && snapshot.currentCircuitCorrect} fault={showStart && !snapshot.currentCircuitCorrect} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <ArrowNode id="impedanceFault" x={486} y={346} width={182} height={56} title="阻抗故障量设置正确" value={showStart && experiment.impedanceFaultSettingCorrect} fault={showStart && !experiment.impedanceFaultSettingCorrect} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <AndBlock id="startAnd" x={828} y={286} width={142} height={240} value={middlePrep} activeNode={activeNode} onFocus={onNodeFocus} />
      <FormulaNode id="current" x={1030} y={370} width={156} height={60} formulaText="Z < ZsetⅡ" currentText={`当前：${formatNumber(experiment.impedanceValue)}Ω / ${formatNumber(experiment.impedanceSetting)}Ω`} value={showStart && snapshot.currentCriterion} fault={showStart && !snapshot.currentCriterion} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <ArrowNode id="started" x={1228} y={372} width={162} height={56} title="接地距离Ⅱ段" detail="启动" value={showStart && snapshot.stageStarted} fault={showStart && !snapshot.stageStarted} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />

      <AndBlock id="permitted" x={1406} y={278} width={122} height={146} value={showPermit && snapshot.actionPermitted} activeNode={activeNode} onFocus={onNodeFocus} />
      <VariableDelayNode activeNode={activeNode} elapsed={elapsed} progress={progress} reached={showDelay} running={showDelay && snapshot.actionPermitted && !snapshot.stageAction} settingLabel="tⅡ.set" value={showAction && snapshot.stageAction} x={1582} y={306} onFocus={onNodeFocus} />
      <ArrowNode id="stageAction" x={1688} y={306} width={158} height={60} title="接地距离Ⅱ段" detail="动作" value={showAction && snapshot.stageAction} action={showAction && snapshot.stageAction} pending={!showAction} activeNode={activeNode} onFocus={onNodeFocus} />

      <ValueLabel x={902} y={138} value={showEnable && experiment.distanceHardPlate} />
      <ValueLabel x={902} y={194} value={showEnable && experiment.distanceSoftPlate} />
      <ValueLabel x={902} y={250} value={showEnable && experiment.distanceStageTwoControlWord} />
      <ValueLabel x={1110} y={194} value={showEnable && snapshot.stageEnabled} />
      <ValueLabel x={260} y={440} value={showStart && experiment.voltageCircuitCorrect} />
      <ValueLabel x={260} y={520} value={showStart && experiment.preFaultStateCorrect} />
      <ValueLabel x={430} y={480} value={tvPrep} />
      <ValueLabel x={590} y={480} value={showStart && tvResetPath} />
      <ValueLabel x={740} y={340} value={showStart && snapshot.currentCircuitCorrect} />
      <ValueLabel x={740} y={374} value={showStart && experiment.impedanceFaultSettingCorrect} />
      <ValueLabel x={740} y={486} value={showStart && tvResetPath} />
      <ValueLabel x={1000} y={400} value={middlePrep} />
      <ValueLabel x={1210} y={400} value={showStart && snapshot.currentCriterion} />
      <ValueLabel x={1398} y={400} value={showStart && snapshot.stageStarted} />
      <ValueLabel x={1335} y={322} value={showPermit && snapshot.stageEnabled} />
      <ValueLabel x={1554} y={336} value={showPermit && snapshot.actionPermitted} />
    </svg>
  );
}

function ReclosingChargeDiagram({
  activeNode,
  elapsed,
  experiment,
  flowStage,
  onNodeFocus,
  snapshot
}: {
  activeNode: string;
  elapsed: number;
  experiment: ExperimentState;
  flowStage: FlowStage;
  onNodeFocus: (id: string) => void;
  snapshot: LogicSnapshot;
}) {
  const showEnable = stageReached(flowStage, "enable");
  const showStart = stageReached(flowStage, "start");
  const showPermit = stageReached(flowStage, "permit");
  const showDelay = stageReached(flowStage, "delay");
  const showAction = stageReached(flowStage, "action");
  const progress = Math.min(1, experiment.chargeDelaySetting > 0 ? elapsed / experiment.chargeDelaySetting : 0);
  const enableInputs = [
    { id: "recloseHard", title: "重合闸硬压板", detail: "投入", value: experiment.reclosingHardPlate, y: 96 },
    { id: "recloseSoft", title: "重合闸软压板", detail: "投入", value: experiment.reclosingSoftPlate, y: 178 },
    { id: "stopControl", title: "停用重合闸控制字=0", detail: "硬压板未投", value: experiment.reclosingStopControlOff, y: 260 },
    { id: "banControl", title: "禁用重合闸控制字=0", value: experiment.reclosingBanControlOff, y: 352 },
    { id: "noBlock", title: "无外部闭锁", detail: "重合闸信号", value: experiment.noExternalBlockSignal, y: 444 }
  ];

  return (
    <svg className="logic-diagram original-style" style={{ width: 1780, height: 700 }} preserveAspectRatio="xMidYMid meet" viewBox="0 0 1780 700" role="img" aria-label="重合闸充电逻辑图">
      {enableInputs.map((input) => (
        <g key={input.id}>
          <ArrowNode id={input.id} x={60} y={input.y} width={288} height={64} title={input.title} detail={input.detail} value={showEnable && input.value} fault={showEnable && !input.value} pending={!showEnable} activeNode={activeNode} onFocus={onNodeFocus} />
          <Wire path={`M348 ${input.y + 32} H448`} active={showEnable && input.value} fault={showEnable && !input.value} />
          <ValueLabel x={384} y={input.y + 32} value={showEnable && input.value} />
        </g>
      ))}
      <AndBlock id="enableAnd" x={448} y={120} width={150} height={420} value={showEnable && snapshot.stageEnabled} activeNode={activeNode} onFocus={onNodeFocus} />
      <Wire path="M598 330 H1138" active={showEnable && snapshot.stageEnabled} fault={showEnable && !snapshot.stageEnabled} />

      <ArrowNode id="protectionNotStarted" x={790} y={120} width={280} height={64} title="保护未启动" value={showStart && experiment.protectionNotStarted} fault={showStart && !experiment.protectionNotStarted} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <Wire path="M1070 152 H1138 V260" active={showStart && experiment.protectionNotStarted} fault={showStart && !experiment.protectionNotStarted} />
      <ArrowNode id="current" x={790} y={496} width={280} height={64} title="断路器合位" detail={`TWJ=0，HWJ=${experiment.breakerClosed ? "1" : "0"}`} value={showStart && experiment.breakerClosed} fault={showStart && !experiment.breakerClosed} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <Wire path="M1070 528 H1138 V420" active={showStart && experiment.breakerClosed} fault={showStart && !experiment.breakerClosed} />
      <AndBlock id="permitted" x={1138} y={240} width={152} height={260} value={showPermit && snapshot.actionPermitted} activeNode={activeNode} onFocus={onNodeFocus} />
      <Wire path="M1290 370 H1368" active={showPermit && snapshot.actionPermitted} fault={showPermit && !snapshot.actionPermitted} />
      <VariableDelayNode activeNode={activeNode} elapsed={elapsed} progress={progress} reached={showDelay} running={showDelay && snapshot.actionPermitted && !snapshot.stageAction} settingLabel="tTVDX" value={showAction && snapshot.stageAction} x={1368} y={340} onFocus={onNodeFocus} />
      <Wire path="M1432 370 H1480" active={showDelay && snapshot.actionPermitted} timing={showDelay && snapshot.actionPermitted && !snapshot.stageAction} />
      <ArrowNode id="stageAction" x={1480} y={340} width={202} height={64} title="重合闸充电成功" value={showAction && snapshot.stageAction} action={showAction && snapshot.stageAction} pending={!showAction} activeNode={activeNode} onFocus={onNodeFocus} />

      <ValueLabel x={626} y={330} value={showEnable && snapshot.stageEnabled} />
      <ValueLabel x={1110} y={152} value={showStart && experiment.protectionNotStarted} />
      <ValueLabel x={1110} y={528} value={showStart && experiment.breakerClosed} />
      <ValueLabel x={1322} y={370} value={showPermit && snapshot.actionPermitted} />
      <text className="logic-annotation" x="1332" y="318">15s（充电时间为15s）</text>
      <text className="logic-annotation" x="1480" y="462">对应现象：充电完成灯常亮</text>
      <text className="logic-annotation" x="1480" y="492">闪烁表示正在充电，不亮表示放电</text>
    </svg>
  );
}

function OvercurrentStageOneDiagram({
  activeNode,
  elapsed,
  experiment,
  flowStage,
  onNodeFocus,
  snapshot
}: {
  activeNode: string;
  elapsed: number;
  experiment: ExperimentState;
  flowStage: FlowStage;
  onNodeFocus: (id: string) => void;
  snapshot: LogicSnapshot;
}) {
  const showEnable = stageReached(flowStage, "enable");
  const showStart = stageReached(flowStage, "start");
  const showPermit = stageReached(flowStage, "permit");
  const showDelay = stageReached(flowStage, "delay");
  const showAction = stageReached(flowStage, "action");
  const directionPath = !experiment.overcurrentDirectionalControl || experiment.overcurrentDirectionSatisfied;
  const voltagePath = !experiment.overcurrentLowVoltageBlockControl || experiment.overcurrentVoltageSatisfied;
  const ptExitPath = experiment.voltageCircuitCorrect && experiment.preFaultStateCorrect && experiment.ptTripReturned;
  const startPrep = showStart && snapshot.currentCircuitCorrect && directionPath && voltagePath && ptExitPath;
  const progress = Math.min(1, experiment.delaySetting > 0 ? elapsed / experiment.delaySetting : 0);

  return (
    <svg className="logic-diagram original-style" style={{ width: 2060, height: 700 }} preserveAspectRatio="xMidYMid meet" viewBox="0 0 2060 700" role="img" aria-label="过流Ⅰ段动作逻辑图">
      <Wire path="M742 92 H890" active={showEnable && experiment.overcurrentHardPlate} fault={showEnable && !experiment.overcurrentHardPlate} />
      <Wire path="M742 174 H890" active={showEnable && experiment.overcurrentSoftPlate} fault={showEnable && !experiment.overcurrentSoftPlate} />
      <ArrowNode id="overHard" x={520} y={60} width={222} height={64} title="过流Ⅰ段硬压板" detail="投入" value={showEnable && experiment.overcurrentHardPlate} fault={showEnable && !experiment.overcurrentHardPlate} pending={!showEnable} activeNode={activeNode} onFocus={onNodeFocus} />
      <ArrowNode id="overSoft" x={520} y={142} width={222} height={64} title="过流Ⅰ段软压板" detail="投入" value={showEnable && experiment.overcurrentSoftPlate} fault={showEnable && !experiment.overcurrentSoftPlate} pending={!showEnable} activeNode={activeNode} onFocus={onNodeFocus} />
      <AndBlock id="enableAnd" x={890} y={38} width={128} height={206} value={showEnable && snapshot.stageEnabled} activeNode={activeNode} onFocus={onNodeFocus} />
      <Wire path="M1018 142 H1188" active={showEnable && snapshot.stageEnabled} fault={showEnable && !snapshot.stageEnabled} />
      <ArrowNode id="stageEnabled" x={1188} y={110} width={250} height={64} title="过流Ⅰ段投入" value={showEnable && snapshot.stageEnabled} fault={showEnable && !snapshot.stageEnabled} pending={!showEnable} activeNode={activeNode} onFocus={onNodeFocus} />
      <Wire path="M1438 142 H1580 V256" active={showPermit && snapshot.stageEnabled} fault={showPermit && !snapshot.stageEnabled} />

      <Wire path="M744 332 H892" active={showStart && snapshot.currentCircuitCorrect} fault={showStart && !snapshot.currentCircuitCorrect} />
      <Wire path="M744 414 H892" active={showStart && directionPath} fault={showStart && !directionPath} />
      <Wire path="M744 498 H892" active={showStart && voltagePath} fault={showStart && !voltagePath} />
      <ArrowNode id="circuit" x={520} y={300} width={224} height={64} title="电流回路接线" detail="正确" value={showStart && snapshot.currentCircuitCorrect} fault={showStart && !snapshot.currentCircuitCorrect} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <ArrowNode id="direction" x={520} y={382} width={224} height={64} title="故障量方向满足" value={showStart && directionPath} fault={showStart && !directionPath} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <ArrowNode id="voltage" x={520} y={466} width={224} height={64} title="故障量电压满足" value={showStart && voltagePath} fault={showStart && !voltagePath} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <line className="delay-symbol-line" x1="760" y1="396" x2="834" y2="376" />
      <text className="logic-annotation" x="760" y="444">过流Ⅰ段带方向控制</text>
      <text className="logic-annotation" x="810" y="474">字=1</text>
      <line className="delay-symbol-line" x1="760" y1="480" x2="834" y2="460" />
      <text className="logic-annotation" x="760" y="528">过流Ⅰ段低压闭锁控</text>
      <text className="logic-annotation" x="810" y="558">制字=1</text>

      <Wire path="M220 544 H302" active={showStart && experiment.voltageCircuitCorrect} fault={showStart && !experiment.voltageCircuitCorrect} />
      <Wire path="M220 626 H302" active={showStart && experiment.preFaultStateCorrect} fault={showStart && !experiment.preFaultStateCorrect} />
      <ArrowNode id="voltageCircuit" x={28} y={512} width={192} height={64} title="电压回路接线正确" value={showStart && experiment.voltageCircuitCorrect} fault={showStart && !experiment.voltageCircuitCorrect} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <ArrowNode id="preFault" x={28} y={594} width={192} height={64} title="故障前状态设置正确" value={showStart && experiment.preFaultStateCorrect} fault={showStart && !experiment.preFaultStateCorrect} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <AndBlock id="ptPrepAnd" x={302} y={494} width={126} height={184} value={showStart && experiment.voltageCircuitCorrect && experiment.preFaultStateCorrect} activeNode={activeNode} onFocus={onNodeFocus} />
      <Wire path="M428 586 H500" active={showStart && experiment.voltageCircuitCorrect && experiment.preFaultStateCorrect} fault={showStart && (!experiment.voltageCircuitCorrect || !experiment.preFaultStateCorrect)} />
      <VariableDelayNode id="ptResetDelay" activeNode={activeNode} elapsed={elapsed} progress={Math.min(1, elapsed / 15)} reached={showStart} running={showStart && experiment.voltageCircuitCorrect && experiment.preFaultStateCorrect && !ptExitPath} settingLabel="tTVDX" value={showStart && ptExitPath} x={500} y={556} onFocus={onNodeFocus} />
      <Wire path="M564 586 H620" active={showStart && ptExitPath} fault={showStart && !ptExitPath} />
      <ArrowNode id="ptReset" x={620} y={556} width={214} height={64} title="PT断线退出" value={showStart && ptExitPath} fault={showStart && !ptExitPath} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <Wire path="M834 588 H892" active={showStart && ptExitPath} fault={showStart && !ptExitPath} />
      <text className="logic-annotation" x="620" y="648">现象：PT断线灯熄灭</text>

      <AndBlock id="startAnd" x={892} y={286} width={128} height={370} value={startPrep} activeNode={activeNode} onFocus={onNodeFocus} />
      <Wire path="M1020 470 H1068" active={startPrep} fault={showStart && !startPrep} />
      <FormulaNode id="current" x={1068} y={440} width={190} height={60} formulaText="I > Iset" currentText={`当前：${formatNumber(experiment.phaseCurrent)}A / ${formatNumber(experiment.phaseCurrentSetting)}A`} value={showStart && snapshot.currentCriterion} fault={showStart && !snapshot.currentCriterion} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <Wire path="M1258 470 H1308" active={showStart && snapshot.currentCriterion} fault={showStart && !snapshot.currentCriterion} />
      <ArrowNode id="started" x={1308} y={438} width={204} height={64} title="过流Ⅰ段启动" value={showStart && snapshot.stageStarted} fault={showStart && !snapshot.stageStarted} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <Wire path="M1512 470 H1580 V438" active={showPermit && snapshot.stageStarted} fault={showPermit && !snapshot.stageStarted} />

      <AndBlock id="permitted" x={1580} y={206} width={126} height={420} value={showPermit && snapshot.actionPermitted} activeNode={activeNode} onFocus={onNodeFocus} />
      <Wire path="M1706 416 H1736" active={showPermit && snapshot.actionPermitted} fault={showPermit && !snapshot.actionPermitted} />
      <VariableDelayNode activeNode={activeNode} elapsed={elapsed} progress={progress} reached={showDelay} running={showDelay && snapshot.actionPermitted && !snapshot.stageAction} settingLabel="tⅠ.set" value={showAction && snapshot.stageAction} x={1736} y={386} onFocus={onNodeFocus} />
      <Wire path="M1800 416 H1830" active={showDelay && snapshot.actionPermitted} timing={showDelay && snapshot.actionPermitted && !snapshot.stageAction} />
      <ArrowNode id="stageAction" x={1830} y={386} width={160} height={64} title="过流Ⅰ段动作" value={showAction && snapshot.stageAction} action={showAction && snapshot.stageAction} pending={!showAction} activeNode={activeNode} onFocus={onNodeFocus} />

      <ValueLabel x={770} y={92} value={showEnable && experiment.overcurrentHardPlate} />
      <ValueLabel x={770} y={174} value={showEnable && experiment.overcurrentSoftPlate} />
      <ValueLabel x={1050} y={142} value={showEnable && snapshot.stageEnabled} />
      <ValueLabel x={770} y={332} value={showStart && snapshot.currentCircuitCorrect} />
      <ValueLabel x={770} y={414} value={showStart && directionPath} />
      <ValueLabel x={770} y={498} value={showStart && voltagePath} />
      <ValueLabel x={452} y={586} value={showStart && experiment.voltageCircuitCorrect && experiment.preFaultStateCorrect} />
      <ValueLabel x={1048} y={470} value={startPrep} />
      <ValueLabel x={1284} y={470} value={showStart && snapshot.currentCriterion} />
      <ValueLabel x={1554} y={256} value={showPermit && snapshot.stageEnabled} />
      <ValueLabel x={1554} y={438} value={showPermit && snapshot.stageStarted} />
      <ValueLabel x={1724} y={416} value={showPermit && snapshot.actionPermitted} />
    </svg>
  );
}

function GenericLogicDiagram({
  actionLabel,
  activeNode,
  delayLabel,
  elapsed,
  enableInputs,
  enableOutputLabel,
  flowStage,
  formulaLabel,
  formulaValue,
  onNodeFocus,
  snapshot,
  startInputs,
  startOutputLabel,
  timerSetting
}: {
  actionLabel: string;
  activeNode: string;
  delayLabel: string;
  elapsed: number;
  enableInputs: Array<{ id: string; title: string; detail?: string; value: boolean }>;
  enableOutputLabel: string;
  flowStage: FlowStage;
  formulaLabel: string;
  formulaValue: string;
  onNodeFocus: (id: string) => void;
  snapshot: LogicSnapshot;
  startInputs: Array<{ id: string; title: string; detail?: string; value: boolean }>;
  startOutputLabel: string;
  timerSetting: number;
}) {
  const showEnable = stageReached(flowStage, "enable");
  const showStart = stageReached(flowStage, "start");
  const showPermit = stageReached(flowStage, "permit");
  const showDelay = stageReached(flowStage, "delay");
  const showAction = stageReached(flowStage, "action");
  const enableGateValue = showEnable && snapshot.stageEnabled;
  const startGateValue = showStart && snapshot.stageStarted;
  const formulaValueOn = showStart && snapshot.currentCriterion;
  const actionAllowed = showPermit && snapshot.actionPermitted;
  const actionValue = showAction && snapshot.stageAction;
  const progress = Math.min(1, timerSetting > 0 ? elapsed / timerSetting : 0);
  const enableY = enableInputs.length > 3 ? 34 : 72;
  const startY = startInputs.length > 3 ? 282 : 334;

  return (
    <svg className="logic-diagram original-style" preserveAspectRatio="xMidYMid meet" viewBox="0 0 1320 560" role="img" aria-label={`${actionLabel}逻辑图`}>
      {enableInputs.map((input, index) => {
        const y = enableY + index * 54;
        return (
          <g key={input.id}>
            <ArrowNode id={input.id} x={70} y={y} width={220} height={48} title={input.title} detail={input.detail} value={showEnable && input.value} fault={showEnable && !input.value} pending={!showEnable} activeNode={activeNode} onFocus={onNodeFocus} />
            <Wire path={`M290 ${y + 24} H420`} active={showEnable && input.value} fault={showEnable && !input.value} />
            <ValueLabel x={320} y={y + 24} value={showEnable && input.value} />
          </g>
        );
      })}
      <AndBlock id="enableAnd" x={420} y={enableY + 12} width={120} height={Math.max(126, enableInputs.length * 54 - 6)} value={enableGateValue} activeNode={activeNode} onFocus={onNodeFocus} />
      <Wire path={`M540 ${enableY + 74} H596 V242 H630`} active={enableGateValue} fault={showEnable && !snapshot.stageEnabled} />
      <ArrowNode id="stageEnabled" x={630} y={216} width={156} height={52} title={enableOutputLabel} value={enableGateValue} fault={showEnable && !snapshot.stageEnabled} pending={!showEnable} activeNode={activeNode} onFocus={onNodeFocus} />
      <ValueLabel x={812} y={242} value={enableGateValue} />

      {startInputs.map((input, index) => {
        const y = startY + index * 54;
        return (
          <g key={input.id}>
            <ArrowNode id={input.id} x={70} y={y} width={220} height={48} title={input.title} detail={input.detail} value={showStart && input.value} fault={showStart && !input.value} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
            <Wire path={`M290 ${y + 24} H420`} active={showStart && input.value} fault={showStart && !input.value} />
            <ValueLabel x={320} y={y + 24} value={showStart && input.value} />
          </g>
        );
      })}
      <AndBlock id="startAnd" x={420} y={startY + 10} width={120} height={Math.max(114, startInputs.length * 54 - 6)} value={startGateValue} activeNode={activeNode} onFocus={onNodeFocus} />
      <Wire path={`M540 ${startY + 68} H600`} active={startGateValue} fault={showStart && !snapshot.stageStarted} />
      <FormulaNode id="current" x={600} y={startY + 38} width={168} height={60} formulaText={formulaLabel} currentText={formulaValue} value={formulaValueOn} fault={showStart && !snapshot.currentCriterion} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <Wire path={`M768 ${startY + 68} H820`} active={formulaValueOn} fault={showStart && !snapshot.currentCriterion} />
      <ArrowNode id="started" x={820} y={startY + 38} width={154} height={60} title={startOutputLabel} value={startGateValue} fault={showStart && !snapshot.stageStarted} pending={!showStart} activeNode={activeNode} onFocus={onNodeFocus} />
      <ValueLabel x={794} y={startY + 68} value={formulaValueOn} />

      <Wire path="M786 242 H890 V298 H920" active={showPermit && snapshot.stageEnabled} fault={showPermit && !snapshot.stageEnabled} />
      <Wire path={`M974 ${startY + 68} H920 V342`} active={showPermit && snapshot.stageStarted} fault={showPermit && !snapshot.stageStarted} />
      <AndBlock id="permitted" x={920} y={236} width={120} height={168} value={actionAllowed} activeNode={activeNode} onFocus={onNodeFocus} />
      <Wire path="M1040 320 H1068" active={actionAllowed} fault={showPermit && !snapshot.actionPermitted} />
      <ValueLabel x={894} y={298} value={showPermit && snapshot.stageEnabled} />
      <ValueLabel x={894} y={342} value={showPermit && snapshot.stageStarted} />
      <ValueLabel x={1054} y={320} value={actionAllowed} />

      <VariableDelayNode activeNode={activeNode} elapsed={elapsed} progress={progress} reached={showDelay} running={actionAllowed && !actionValue} settingLabel={delayLabel} value={actionValue} x={1068} y={290} onFocus={onNodeFocus} />
      <Wire path="M1132 320 H1160" active={showDelay && actionAllowed} timing={showDelay && actionAllowed && !actionValue} />
      <ArrowNode id="stageAction" x={1160} y={290} width={148} height={60} title={actionLabel} value={actionValue} action={actionValue} pending={!showAction} activeNode={activeNode} onFocus={onNodeFocus} />
    </svg>
  );
}

function Wire({ path, active, fault, timing }: { path: string; active: boolean; fault?: boolean; timing?: boolean }) {
  return <path className={`logic-wire ${active ? "on" : ""} ${fault ? "fault" : ""} ${timing ? "timing" : ""}`} d={path} />;
}

function ArrowNode(props: {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  detail?: string;
  value: boolean;
  fault?: boolean;
  action?: boolean;
  pending?: boolean;
  activeNode: string;
  onFocus: (id: string) => void;
}) {
  const notch = Math.min(52, props.width * 0.28);
  const points = `${props.x},${props.y} ${props.x + props.width - notch},${props.y} ${props.x + props.width},${props.y + props.height / 2} ${props.x + props.width - notch},${props.y + props.height} ${props.x},${props.y + props.height}`;
  const titleY = props.detail ? props.y + props.height / 2 - 4 : props.y + props.height / 2 + 6;
  return (
    <g className={`svg-node arrow ${props.value ? "on" : "off"} ${props.fault ? "fault" : ""} ${props.action ? "action" : ""} ${props.pending ? "pending" : ""} ${props.activeNode === props.id ? "selected" : ""}`} role="button" tabIndex={0} onClick={() => props.onFocus(props.id)}>
      <polygon points={points} />
      <text x={props.x + props.width / 2 - notch / 4} y={titleY} textAnchor="middle">{props.title}</text>
      {props.detail ? <text x={props.x + props.width / 2 - notch / 4} y={props.y + props.height / 2 + 18} textAnchor="middle">{props.detail}</text> : null}
    </g>
  );
}

function FormulaNode(props: {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  formulaText?: string;
  currentText: string;
  value: boolean;
  fault?: boolean;
  pending?: boolean;
  activeNode: string;
  onFocus: (id: string) => void;
}) {
  const notch = Math.min(52, props.width * 0.28);
  const points = `${props.x},${props.y} ${props.x + props.width - notch},${props.y} ${props.x + props.width},${props.y + props.height / 2} ${props.x + props.width - notch},${props.y + props.height} ${props.x},${props.y + props.height}`;
  const centerX = props.x + props.width / 2 - notch / 4;
  return (
    <g className={`svg-node arrow formula-node ${props.value ? "on" : "off"} ${props.fault ? "fault" : ""} ${props.pending ? "pending" : ""} ${props.activeNode === props.id ? "selected" : ""}`} role="button" tabIndex={0} onClick={() => props.onFocus(props.id)}>
      <polygon points={points} />
      <text className="formula-text" x={centerX} y={props.y + 25} textAnchor="middle">{props.formulaText ?? "3I₀ > I₀.setⅢ"}</text>
      <text className="formula-value" x={centerX} y={props.y + 44} textAnchor="middle">{props.currentText}</text>
    </g>
  );
}

function AndBlock(props: {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  value: boolean;
  activeNode: string;
  onFocus: (id: string) => void;
}) {
  return (
    <g className={`svg-node gate ${props.value ? "on" : "off"} ${props.activeNode === props.id ? "selected" : ""}`} role="button" tabIndex={0} onClick={() => props.onFocus(props.id)}>
      <rect x={props.x} y={props.y} width={props.width} height={props.height} />
      <text x={props.x + props.width / 2} y={props.y + props.height / 2 + 8} textAnchor="middle">&amp;</text>
    </g>
  );
}

function ValueLabel({ x, y, value }: { x: number; y: number; value: boolean }) {
  return (
    <g className={`logic-value-label ${value ? "one" : "zero"}`}>
      <rect x={x - 10} y={y - 14} width="20" height="20" rx="4" />
      <text x={x} y={y + 1} textAnchor="middle">{value ? "1" : "0"}</text>
    </g>
  );
}

function DelayNode({
  activeNode,
  elapsed,
  progress,
  reached,
  running,
  setting,
  value,
  onFocus
}: {
  activeNode: string;
  elapsed: number;
  progress: number;
  reached: boolean;
  running: boolean;
  setting: number;
  value: boolean;
  onFocus: (id: string) => void;
}) {
  return (
    <g className={`svg-node delay ${value ? "on" : ""} ${running ? "timing" : ""} ${!reached ? "pending" : ""} ${activeNode === "delay" ? "selected" : ""}`} role="button" tabIndex={0} onClick={() => onFocus("delay")}>
      <rect x="1068" y="288" width="62" height="60" />
      <line className="delay-symbol-line" x1="1076" y1="300" x2="1122" y2="300" />
      <line className="delay-symbol-line" x1="1076" y1="300" x2="1076" y2="306" />
      <line className="delay-symbol-line" x1="1122" y1="300" x2="1122" y2="306" />
      <text x="1099" y="327" textAnchor="middle">tⅢ</text>
      <text x="1099" y="342" textAnchor="middle">0.set</text>
      <rect className="delay-fill" x="1068" y="346" width={62 * progress} height="2" />
    </g>
  );
}

function VariableDelayNode({
  activeNode,
  elapsed,
  id = "delay",
  progress,
  reached,
  running,
  settingLabel,
  value,
  x,
  y,
  onFocus
}: {
  activeNode: string;
  elapsed: number;
  id?: string;
  progress: number;
  reached: boolean;
  running: boolean;
  settingLabel: string;
  value: boolean;
  x: number;
  y: number;
  onFocus: (id: string) => void;
}) {
  return (
    <g className={`svg-node delay ${value ? "on" : ""} ${running ? "timing" : ""} ${!reached ? "pending" : ""} ${activeNode === id ? "selected" : ""}`} role="button" tabIndex={0} onClick={() => onFocus(id)}>
      <rect x={x} y={y} width="64" height="60" />
      <line className="delay-symbol-line" x1={x + 8} y1={y + 12} x2={x + 56} y2={y + 12} />
      <line className="delay-symbol-line" x1={x + 8} y1={y + 12} x2={x + 8} y2={y + 18} />
      <line className="delay-symbol-line" x1={x + 56} y1={y + 12} x2={x + 56} y2={y + 18} />
      <text x={x + 32} y={y + 39} textAnchor="middle">{settingLabel}</text>
      <text x={x + 32} y={y + 54} textAnchor="middle">{formatNumber(elapsed)}s</text>
      <rect className="delay-fill" x={x} y={y + 58} width={64 * progress} height="2" />
    </g>
  );
}

function NodeInspector({ activeNode, experiment, snapshot, elapsed }: { activeNode: string; experiment: ExperimentState; snapshot: LogicSnapshot; elapsed: number }) {
  const activeDelaySetting =
    experiment.logicType === "reclosingCharge" ? experiment.chargeDelaySetting : experiment.delaySetting;
  const tvResetPath = experiment.voltageCircuitCorrect && experiment.preFaultStateCorrect && experiment.tvResetDone;
  const ptExitPath = experiment.voltageCircuitCorrect && experiment.preFaultStateCorrect && experiment.ptTripReturned;
  const nodeDetails: Record<string, string> = Object.fromEntries(
    Object.entries(snapshot.nodes).map(([id, node]) => [
      id,
      `节点：${node.label}。当前值：${node.value ? "1" : "0"}。计算依据：${node.reason} 当前输入：${Object.entries(
        node.upstream
      )
        .map(([key, value]) => `${key}=${value}`)
        .join("，")}。未满足条件：${node.unmetConditions.join("，") || "无"}。`
    ])
  );
  const details: Record<string, string> = {
    hard: `当前值：${experiment.zeroSequenceHardPlate ? "1，硬压板已投入" : "0，硬压板退出"}。`,
    soft: `当前值：${experiment.zeroSequenceSoftPlate ? "1，软压板已投入" : "0，软压板退出"}。`,
    control: `当前值：${experiment.stageThreeControlWord ? "1，控制字已投入" : "0，控制字退出"}。`,
    distanceHard: `当前值：${experiment.distanceHardPlate ? "1，距离保护硬压板已投入" : "0，距离保护硬压板退出"}。`,
    distanceSoft: `当前值：${experiment.distanceSoftPlate ? "1，接地距离保护软压板已投入" : "0，接地距离保护软压板退出"}。`,
    distanceControl: `当前值：${experiment.distanceStageTwoControlWord ? "1，接地距离Ⅱ段控制字已投入" : "0，接地距离Ⅱ段控制字退出"}。`,
    voltageCircuit: `当前值：${experiment.voltageCircuitCorrect ? "1，电压回路接线正确" : "0，电压回路接线不正确"}。`,
    preFault: `当前值：${experiment.preFaultStateCorrect ? "1，故障前状态设置正确" : "0，故障前状态设置不正确"}。`,
    impedanceFault: `当前值：${experiment.impedanceFaultSettingCorrect ? "1，阻抗故障量设置正确" : "0，阻抗故障量设置不正确"}。`,
    tvPrepAnd: `当前值：${experiment.voltageCircuitCorrect && experiment.preFaultStateCorrect ? "1" : "0"}。计算依据：电压回路接线正确与故障前状态设置正确采用AND逻辑，两者均为1时启动TV断线复归延时。`,
    tvResetDelay: `节点：TV断线复归延时。当前值：${tvResetPath ? "1" : "0"}。计算依据：电压回路接线正确和故障前状态设置正确后，经tTVDX延时完成TV断线复归支路。当前输入：电压回路=${experiment.voltageCircuitCorrect ? "1" : "0"}，故障前状态=${experiment.preFaultStateCorrect ? "1" : "0"}，TV断线复归=${experiment.tvResetDone ? "1" : "0"}。`,
    tvReset: `当前值：${tvResetPath ? "1，TV断线复归支路完成" : "0，TV断线复归支路未完成"}。当前输入：电压回路接线正确=${experiment.voltageCircuitCorrect ? "1" : "0"}，故障前状态设置正确=${experiment.preFaultStateCorrect ? "1" : "0"}，TV断线复归=${experiment.tvResetDone ? "1" : "0"}。`,
    recloseHard: `当前值：${experiment.reclosingHardPlate ? "1，重合闸硬压板已投入" : "0，重合闸硬压板退出"}。`,
    recloseSoft: `当前值：${experiment.reclosingSoftPlate ? "1，重合闸软压板已投入" : "0，重合闸软压板退出"}。`,
    stopControl: `当前值：${experiment.reclosingStopControlOff ? "1，停用重合闸控制字=0" : "0，停用重合闸控制字不为0"}。`,
    banControl: `当前值：${experiment.reclosingBanControlOff ? "1，禁用重合闸控制字=0" : "0，禁用重合闸控制字不为0"}。`,
    noBlock: `当前值：${experiment.noExternalBlockSignal ? "1，无外部闭锁重合闸信号" : "0，存在外部闭锁重合闸信号"}。`,
    protectionNotStarted: `当前值：${experiment.protectionNotStarted ? "1，保护未启动" : "0，保护已启动，重合闸充电条件中断"}。`,
    overHard: `当前值：${experiment.overcurrentHardPlate ? "1，过流Ⅰ段硬压板已投入" : "0，过流Ⅰ段硬压板退出"}。`,
    overSoft: `当前值：${experiment.overcurrentSoftPlate ? "1，过流Ⅰ段软压板已投入" : "0，过流Ⅰ段软压板退出"}。`,
    direction: `当前值：${!experiment.overcurrentDirectionalControl || experiment.overcurrentDirectionSatisfied ? "1" : "0"}。方向控制字为${experiment.overcurrentDirectionalControl ? "1" : "0"}，故障量方向${experiment.overcurrentDirectionSatisfied ? "满足" : "不满足"}。`,
    voltage: `当前值：${!experiment.overcurrentLowVoltageBlockControl || experiment.overcurrentVoltageSatisfied ? "1" : "0"}。低压闭锁控制字为${experiment.overcurrentLowVoltageBlockControl ? "1" : "0"}，故障量电压${experiment.overcurrentVoltageSatisfied ? "满足" : "不满足"}。`,
    ptPrepAnd: `当前值：${experiment.voltageCircuitCorrect && experiment.preFaultStateCorrect ? "1" : "0"}。计算依据：电压回路接线正确与故障前状态设置正确采用AND逻辑，两者均为1时启动PT断线退出延时。`,
    ptResetDelay: `节点：PT断线退出延时。当前值：${ptExitPath ? "1" : "0"}。计算依据：电压回路接线正确和故障前状态设置正确后，经tTVDX延时完成PT断线退出支路。当前输入：电压回路=${experiment.voltageCircuitCorrect ? "1" : "0"}，故障前状态=${experiment.preFaultStateCorrect ? "1" : "0"}，PT断线退出=${experiment.ptTripReturned ? "1" : "0"}。`,
    ptReset: `当前值：${ptExitPath ? "1，PT断线退出支路完成" : "0，PT断线退出支路未完成"}。当前输入：电压回路接线正确=${experiment.voltageCircuitCorrect ? "1" : "0"}，故障前状态设置正确=${experiment.preFaultStateCorrect ? "1" : "0"}，PT断线退出=${experiment.ptTripReturned ? "1" : "0"}。`,
    enableAnd: nodeDetails.stageEnabled,
    stageEnabled: nodeDetails.stageEnabled,
    circuit: `电流回路接线正确=${snapshot.currentCircuitCorrect ? "1" : "0"}，底层状态：${currentCircuitLabels[experiment.currentCircuitState]}。`,
    tester: `测试仪故障量设置正确=${experiment.testerFaultSettingCorrect ? "1" : "0"}。这是老师原图中的保护逻辑输入，不等同于动态推演是否正在运行。`,
    current:
      experiment.logicType === "zeroSequenceStageThree"
        ? `节点：电流比较判据。当前值：${snapshot.currentCriterion ? "1" : "0"}。该节点将实际零序电流 3I₀ 与零序Ⅲ段动作电流定值 I₀.setⅢ 比较；满足 3I₀ > I₀.setⅢ 时输出 1，否则输出 0。当前输入：3I₀=${formatNumber(snapshot.actual3I0)}A，I₀.setⅢ=${formatNumber(experiment.currentSetting)}A。`
        : nodeDetails.currentCriterion,
    compare: nodeDetails.currentCriterion,
    startAnd: nodeDetails.stageStarted,
    started: nodeDetails.stageStarted,
    permitted: nodeDetails.actionPermitted,
    delay: `${nodeDetails.delay} 当前动态计时：${formatNumber(elapsed)}s / ${formatNumber(activeDelaySetting)}s。`,
    stageAction: nodeDetails.stageAction
  };

  return (
    <div className="node-inspector">
      <strong>节点说明</strong>
      <p>{details[activeNode] || details.stageAction}</p>
    </div>
  );
}

function NodeLearningModal({
  material,
  onClose
}: {
  material: NodeLearningMaterial;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="node-learning-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        className="node-learning-modal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="node-learning-head">
          <div>
            <span>{material.subtitle}</span>
            <h2>{material.title}</h2>
          </div>
          <button aria-label="关闭节点资料" type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="node-learning-status">
          <span>当前输出</span>
          <strong className={material.value ? "one" : "zero"}>{material.value ? "1" : "0"}</strong>
          <p>{material.statusText}</p>
        </div>

        <div className="node-learning-body">
          <div className="node-learning-media">
            {material.images.length ? (
              material.images.map((image) => (
                <figure key={image.src}>
                  <img alt={image.alt} src={image.src} />
                  <figcaption>{image.caption}</figcaption>
                </figure>
              ))
            ) : (
              <div className="node-learning-empty">
                <strong>该节点暂无现场照片</strong>
                <p>当前先展示实时判定和解说，后续老师补充素材后可直接绑定到这个节点。</p>
              </div>
            )}
          </div>

          <div className="node-learning-copy">
            {material.textbook ? (
              <section className="node-learning-textbook">
                <div>
                  <span>说明书原文定位</span>
                  <strong>{material.textbook.source}</strong>
                </div>
                <p>{material.textbook.text}</p>
              </section>
            ) : null}
            <section>
              <h3>节点解说</h3>
              <p>{material.summary}</p>
            </section>
            <section>
              <h3>当前判定</h3>
              <p>{material.currentBasis}</p>
            </section>
            <section>
              <h3>操作要点</h3>
              <ol>
                {material.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}

function ManualInterpretationPanel({
  experiment,
  interpretation,
  onUpload,
  snapshot
}: {
  experiment: ExperimentState;
  interpretation: ManualInterpretationState;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  snapshot: LogicSnapshot;
}) {
  const isZeroSequence = experiment.logicType === "zeroSequenceStageThree";
  const ready = interpretation.status === "ready" && isZeroSequence;
  const analyzing = interpretation.status === "analyzing";
  const statusText = analyzing ? "AI解读中" : ready ? "已解读" : "待上传";

  return (
    <section className="side-card manual-interpretation-card">
      <div className="side-card-head">
        <span>说明书解读</span>
        <strong>{statusText}</strong>
      </div>
      <label className="manual-upload-drop">
        <input accept=".pdf,.doc,.docx" type="file" onChange={onUpload} />
        <span>{interpretation.fileName || "上传保护装置说明书"}</span>
        <strong>{analyzing ? "解读中..." : "选择文件"}</strong>
      </label>

      {ready ? (
        <div className="manual-ai-result">
          <div className="manual-source">
            <span>识别模板</span>
            <strong>PSL-603U 系列线路保护装置说明书 V3.30G</strong>
          </div>
          <div className="manual-source">
            <span>保护对象</span>
            <strong>零序过流保护Ⅲ段</strong>
          </div>
          <div className="manual-pages">
            <p><strong>P23</strong> 零序保护：两段定时限保护，投退受零序保护软硬压板和零序保护控制字控制。</p>
            <p><strong>P23</strong> PT断线：零序Ⅲ段在 PT 断线后自动不带方向。</p>
            <p><strong>P24</strong> 非全相运行：零序Ⅲ段动作时间比整定值缩短 0.5s，且自动不带方向。</p>
            <p><strong>P24</strong> 动作结果：零序Ⅲ段动作后三跳并闭锁重合闸。</p>
          </div>
          <div className="manual-node-map">
            <span>已映射到当前状态</span>
            <p>投入={snapshot.stageEnabled ? 1 : 0}，启动={snapshot.stageStarted ? 1 : 0}，延时={snapshot.nodes.delay.value ? 1 : 0}，动作={snapshot.stageAction ? 1 : 0}</p>
          </div>
        </div>
      ) : (
        <p className="manual-empty">
          {isZeroSequence
            ? "上传说明书后，系统将提取原文定位，并同步生成保护状态与节点解释依据。"
            : "当前先以案例一接入说明书解读模板，其他案例可按同一结构扩展。"}
        </p>
      )}
    </section>
  );
}

function StatusAnalysis({ snapshot, experiment, elapsed }: { snapshot: LogicSnapshot; experiment: ExperimentState; elapsed: number }) {
  const rows = [
    [snapshot.nodes.stageEnabled.label, snapshot.stageEnabled],
    ["基础回路/状态", snapshot.currentCircuitCorrect],
    ["故障量/闭锁设置", snapshot.testerFaultSettingCorrect],
    [snapshot.nodes.currentCriterion.label, snapshot.currentCriterion],
    [snapshot.nodes.stageStarted.label, snapshot.stageStarted],
    ["最终动作允许", snapshot.actionPermitted],
    [snapshot.nodes.stageAction.label, snapshot.stageAction]
  ] as const;
  const delaySetting =
    experiment.logicType === "reclosingCharge" ? experiment.chargeDelaySetting : experiment.delaySetting;

  return (
    <section className="side-card">
      <div className="side-card-head">
        <span>当前保护状态</span>
        <strong>{snapshot.stageAction ? "动作" : snapshot.actionPermitted ? "延时中" : snapshot.stageStarted ? "已启动未允许" : "未启动"}</strong>
      </div>
      <div className="state-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong className={value ? "one" : "zero"}>{value ? "1" : "0"}</strong>
          </div>
        ))}
        <div>
          <span>延时计时</span>
          <strong>{formatNumber(elapsed)} / {formatNumber(delaySetting)}s</strong>
        </div>
      </div>
      <div className="reason-list">
        <strong>当前未满足条件</strong>
        {(snapshot.unmetConditions.length ? snapshot.unmetConditions : ["所有动作条件已满足。"]).map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
      <div className="reason-list">
        <strong>故障分析</strong>
        {(snapshot.explanations.length ? snapshot.explanations : ["逻辑状态正常，可开始或继续试验观察延时过程。"]).map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </section>
  );
}

function CaseLibrary({
  activeCaseId,
  cases,
  onSelect
}: {
  activeCaseId: string;
  cases: ProtectionCase[];
  onSelect: (protectionCase: ProtectionCase) => void;
}) {
  const activeCase = cases.find((item) => item.id === activeCaseId) ?? cases[0];

  return (
    <section className="side-card case-library-card">
      <div className="side-card-head">
        <span>逻辑案例</span>
        <strong>{activeCase.status === "available" ? "已接入" : "待接入"}</strong>
      </div>
      <div className="logic-case-list">
        {cases.map((item) => (
          <button
            className={item.id === activeCaseId ? "active" : ""}
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
          >
            <span>{item.shortTitle}</span>
            <small>{item.status === "available" ? "当前可推演" : "待接入"}</small>
          </button>
        ))}
      </div>
      <div className="case-detail">
        <strong>{activeCase.title}</strong>
        <p>{activeCase.description}</p>
        {activeCase.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </section>
  );
}

function CaseFlowPlaceholder({ protectionCase }: { protectionCase: ProtectionCase }) {
  return (
    <div className="case-flow-placeholder">
      <div>
        <span>待接入案例</span>
        <strong>{protectionCase.title}</strong>
        <p>{protectionCase.description}</p>
      </div>
      <div className="placeholder-flow">
        <div>图纸输入</div>
        <span />
        <div>节点建模</div>
        <span />
        <div>规则计算</div>
        <span />
        <div>动态推演</div>
      </div>
      <p className="placeholder-note">
        当前案例拥有独立入口，但还没有绑定专属流程图。接入后，选择该案例会直接展开它自己的逻辑图、参数控制和动作结果。
      </p>
    </div>
  );
}

function ReservedCaseDetail({ protectionCase }: { protectionCase: ProtectionCase }) {
  return (
    <section className="side-card reserved-case-card">
      <div className="side-card-head">
        <span>接入状态</span>
        <strong>待接入</strong>
      </div>
      <p>该案例当前只保留独立入口和说明，不复用其他案例的逻辑图。</p>
      <div className="reserved-checklist">
        <span>后续接入需要补充</span>
        <p>静态图纸、输入条件、逻辑节点、定值比较、延时规则、典型场景。</p>
      </div>
      {protectionCase.notes.map((note) => (
        <p key={note}>{note}</p>
      ))}
    </section>
  );
}

function BottomInsightPanel({
  activeNode,
  activeTab,
  elapsed,
  experiment,
  onTabChange,
  records,
  snapshot
}: {
  activeNode: string;
  activeTab: "node" | "log";
  elapsed: number;
  experiment: ExperimentState;
  onTabChange: (tab: "node" | "log") => void;
  records: OperationRecord[];
  snapshot: LogicSnapshot;
}) {
  return (
    <section className="logic-bottom-panel compact">
      <div className="bottom-tabs">
        <button className={activeTab === "node" ? "active" : ""} type="button" onClick={() => onTabChange("node")}>
          节点说明
        </button>
        <button className={activeTab === "log" ? "active" : ""} type="button" onClick={() => onTabChange("log")}>
          操作记录
        </button>
      </div>
      <div className="bottom-tab-body">
        {activeTab === "node" ? <NodeInspector activeNode={activeNode} experiment={experiment} snapshot={snapshot} elapsed={elapsed} /> : null}
        {activeTab === "log" ? <OperationLog records={records} /> : null}
      </div>
    </section>
  );
}

function LogicExplanation({
  snapshot,
  experiment
}: {
  snapshot: LogicSnapshot;
  experiment: ExperimentState;
}) {
  return (
    <section className="side-card guidance-card">
      <div className="side-card-head">
        <span>逻辑解释</span>
        <strong>{snapshot.stageAction ? "动作" : snapshot.actionPermitted ? "允许" : "未满足"}</strong>
      </div>
      <p>{buildLogicExplanation(snapshot, experiment)}</p>
    </section>
  );
}

function OperationLog({ records }: { records: OperationRecord[] }) {
  return (
    <section className="side-card log-card">
      <div className="side-card-head">
        <span>操作记录</span>
        <strong>{records.length}</strong>
      </div>
      <ol>
        {records.slice(0, 6).map((record) => (
          <li key={record.id}>
            <time>{record.time}</time>
            <strong>{record.action}</strong>
            <p>{[record.before, record.after, record.result].filter(Boolean).join("；")}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PanelBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="control-block">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input checked={value} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
      <strong>{value ? "投入" : "退出"}</strong>
    </label>
  );
}

function NumberField({ label, value, min, step, onChange }: { label: string; value: number; min: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="field-row">
      <span>{label}</span>
      <input min={min} step={step} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
