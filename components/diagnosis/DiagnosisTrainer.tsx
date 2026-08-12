"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode, WheelEvent } from "react";
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

export default function DiagnosisTrainer() {
  const [selectedCaseId, setSelectedCaseId] = useState("zero-sequence-stage-three");
  const [experiment, setExperiment] = useState<ExperimentState>(() => createInitialState());
  const [elapsed, setElapsed] = useState(0);
  const [bottomTab, setBottomTab] = useState<"node" | "log">("node");
  const [records, setRecords] = useState<OperationRecord[]>(() => [
    {
      id: "initial",
      time: nowLabel(),
      action: "进入实验",
      result: "加载零序过流保护Ⅲ段动作逻辑图。"
    }
  ]);
  const [activeNode, setActiveNode] = useState<string>("stageAction");
  const lastSnapshot = useRef<LogicSnapshot | null>(null);
  const wasPermitted = useRef(false);

  const selectedCase =
    protectionCases.find((item) => item.id === selectedCaseId) ?? protectionCases[0];
  const isCaseAvailable = selectedCase.status === "available";
  const snapshot = useMemo(() => calculateProtectionLogic(experiment, elapsed), [elapsed, experiment]);
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
            experiment.testerDuration < experiment.delaySetting
              ? "故障量持续时间不足，保护启动后尚未完成延时便复归。"
              : "达到设定故障量持续时间，推演自动停止。"
          );
        }
        return next;
      });
    }, 100);

    return () => window.clearInterval(timer);
  }, [experiment.testerDuration, experiment.testerOutputRunning]);

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

  function selectCase(nextCase: ProtectionCase) {
    setSelectedCaseId(nextCase.id);
    setElapsed(0);
    wasPermitted.current = false;
    lastSnapshot.current = null;
    setActiveNode("stageAction");
    if (nextCase.status === "available") {
      setExperiment(createInitialState(nextCase.id));
      addRecord("选择逻辑案例", "案例", selectedCase.title, nextCase.title, "已载入该逻辑案例的默认推演条件。");
      return;
    }
    setExperiment({ ...createInitialState(), testerOutputRunning: false });
    addRecord("选择逻辑案例", "案例", selectedCase.title, nextCase.title, "该案例流程图待接入，等待老师提供图纸、节点和逻辑规则。");
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
    wasPermitted.current = false;
    lastSnapshot.current = null;
    addRecord("复位", "实验状态", undefined, undefined, "已恢复当前模式默认参数。");
  }

  return (
    <main className="app-shell logic-trainer-shell">
      <header className="topbar">
        <div className="brand-mark">继保</div>
        <div>
          <p className="eyebrow">将静态继电保护逻辑图转化为可交互的动态逻辑模型</p>
          <h1>保护逻辑动态推演</h1>
        </div>
        <div className="logic-top-status">
          <span>当前状态</span>
          <strong>{protectionStatus}</strong>
        </div>
        <button className="topbar-link" type="button" onClick={resetAll}>
          复位
        </button>
        <Link className="topbar-link" href="/">
          返回功能入口
        </Link>
      </header>

      <section className="logic-workspace">
        <ControlPanel
          experiment={experiment}
          onUpdate={updateField}
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
                <strong>{isCaseAvailable ? `${formatNumber(elapsed)}s / ${formatNumber(experiment.delaySetting)}s` : "待接入"}</strong>
              </div>
            </div>
            {isCaseAvailable ? (
              <DiagramViewport>
                <LogicDiagram
                  activeNode={activeNode}
                  elapsed={elapsed}
                  flowStage={flowStage}
                  experiment={experiment}
                  snapshot={snapshot}
                  onNodeFocus={setActiveNode}
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
          <CaseLibrary
            activeCaseId={selectedCaseId}
            cases={protectionCases}
            onSelect={selectCase}
          />
          {isCaseAvailable ? (
            <>
              <StatusAnalysis snapshot={snapshot} experiment={experiment} elapsed={elapsed} />
              <LogicExplanation snapshot={snapshot} experiment={experiment} />
            </>
          ) : (
            <ReservedCaseDetail protectionCase={selectedCase} />
          )}
        </aside>
      </section>
    </main>
  );
}

function DiagramViewport({ children }: { children: ReactNode }) {
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
        <div className="diagram-stage" style={{ height: 560 * zoom + 28, width: 1320 * zoom + 28 }}>
          <div className="diagram-scale-layer" style={{ transform: `scale(${zoom})` }}>
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
  onPreset: (preset: ScenarioPreset) => void;
  presets: ScenarioPreset[];
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  disabled: boolean;
}) {
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
      <text className="formula-text" x={centerX} y={props.y + 25} textAnchor="middle">3I₀ &gt; I₀.setⅢ</text>
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

function NodeInspector({ activeNode, experiment, snapshot, elapsed }: { activeNode: string; experiment: ExperimentState; snapshot: LogicSnapshot; elapsed: number }) {
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
    enableAnd: nodeDetails.stageEnabled,
    stageEnabled: nodeDetails.stageEnabled,
    circuit: `电流回路接线正确=${snapshot.currentCircuitCorrect ? "1" : "0"}，底层状态：${currentCircuitLabels[experiment.currentCircuitState]}。`,
    tester: `测试仪故障量设置正确=${experiment.testerFaultSettingCorrect ? "1" : "0"}。这是老师原图中的保护逻辑输入，不等同于动态推演是否正在运行。`,
    current: `节点：电流比较判据。当前值：${snapshot.currentCriterion ? "1" : "0"}。该节点将实际零序电流 3I₀ 与零序Ⅲ段动作电流定值 I₀.setⅢ 比较；满足 3I₀ > I₀.setⅢ 时输出 1，否则输出 0。当前输入：3I₀=${formatNumber(snapshot.actual3I0)}A，I₀.setⅢ=${formatNumber(experiment.currentSetting)}A。`,
    compare: `节点：电流比较判据。当前值：${snapshot.currentCriterion ? "1" : "0"}。该节点将实际零序电流 3I₀ 与零序Ⅲ段动作电流定值 I₀.setⅢ 比较；满足 3I₀ > I₀.setⅢ 时输出 1，否则输出 0。当前输入：3I₀=${formatNumber(snapshot.actual3I0)}A，I₀.setⅢ=${formatNumber(experiment.currentSetting)}A。`,
    startAnd: nodeDetails.stageStarted,
    started: nodeDetails.stageStarted,
    permitted: nodeDetails.actionPermitted,
    delay: `${nodeDetails.delay} 当前动态计时：${formatNumber(elapsed)}s / ${formatNumber(experiment.delaySetting)}s。`,
    stageAction: nodeDetails.stageAction
  };

  return (
    <div className="node-inspector">
      <strong>节点说明</strong>
      <p>{details[activeNode] || details.stageAction}</p>
    </div>
  );
}

function StatusAnalysis({ snapshot, experiment, elapsed }: { snapshot: LogicSnapshot; experiment: ExperimentState; elapsed: number }) {
  const rows = [
    ["零序Ⅲ段投入", snapshot.stageEnabled],
    ["电流回路接线正确", snapshot.currentCircuitCorrect],
    ["测试仪故障量设置正确", snapshot.testerFaultSettingCorrect],
    ["电流比较判据", snapshot.currentCriterion],
    ["零序Ⅲ段启动", snapshot.stageStarted],
    ["最终动作允许", snapshot.actionPermitted],
    ["零序Ⅲ段动作", snapshot.stageAction]
  ] as const;

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
          <strong>{formatNumber(elapsed)} / {formatNumber(experiment.delaySetting)}s</strong>
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
