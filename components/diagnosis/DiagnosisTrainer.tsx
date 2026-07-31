"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ChaoxingDigitalHuman from "@/components/ChaoxingDigitalHuman";
import { diagnosisCase } from "@/lib/diagnosis/cases";

type InspectKey = "setting" | "tester" | "sampling" | "wiring" | "enable";

const inspectItems: Array<{
  id: InspectKey;
  title: string;
  value: string;
  note: string;
}> = [
  {
    id: "setting",
    title: "定值",
    value: "I0Ⅲ=2.00A，t=1.50s",
    note: "段别、动作电流和动作时间正确。"
  },
  {
    id: "tester",
    title: "测试仪",
    value: "2.10A，持续1.70s",
    note: "1.05倍电流和持续时间满足动作要求。"
  },
  {
    id: "sampling",
    title: "采样",
    value: "3I0=2.09A",
    note: "装置已正确采到零序电流。"
  },
  {
    id: "wiring",
    title: "接线",
    value: "外接零序端子正常",
    note: "试验接线和端子回路无异常。"
  },
  {
    id: "enable",
    title: "投入状态",
    value: "零序Ⅲ段软压板退出",
    note: "这是导致保护未动作的关键原因。"
  }
];

export default function DiagnosisTrainer() {
  const [softPlateIn, setSoftPlateIn] = useState(false);
  const [testState, setTestState] = useState<"idle" | "blocked" | "success">(
    "idle"
  );
  const [activeInspect, setActiveInspect] = useState<InspectKey>("setting");
  const [inspected, setInspected] = useState<Set<InspectKey>>(
    () => new Set(["setting"])
  );
  const [reportVisible, setReportVisible] = useState(false);
  const [message, setMessage] = useState("先点击“开始试验”，观察信号走到哪里被拦住。");

  const inspectedCount = inspected.size;
  const activeItem = inspectItems.find((item) => item.id === activeInspect)!;
  const actionResult = useMemo(() => {
    if (testState === "success") return "保护动作成功，断路器收到跳闸命令。";
    if (testState === "blocked") return "保护未动作：零序Ⅲ段软压板处于退出状态。";
    return "尚未启动试验。";
  }, [testState]);

  function inspect(id: InspectKey) {
    setActiveInspect(id);
    setInspected((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
    setMessage(inspectItems.find((item) => item.id === id)?.note ?? "");
  }

  function runTest() {
    if (softPlateIn) {
      setTestState("success");
      setReportVisible(true);
      setMessage("复测成功：软压板投入后，零序Ⅲ段动作条件完整，跳闸出口导通。");
      return;
    }

    setTestState("blocked");
    setMessage("电流采样正常，但逻辑在零序Ⅲ段软压板处中断。请检查投入状态。");
  }

  function resetSimulator() {
    setSoftPlateIn(false);
    setTestState("idle");
    setActiveInspect("setting");
    setInspected(new Set(["setting"]));
    setReportVisible(false);
    setMessage("先点击“开始试验”，观察信号走到哪里被拦住。");
  }

  return (
    <main className="app-shell diagnosis-shell simulator-shell">
      <header className="topbar">
        <div className="brand-mark">继保</div>
        <div>
          <p className="eyebrow">线路保护理实一体化实训平台</p>
          <h1>2D故障仿真训练</h1>
        </div>
        <Link className="topbar-link" href="/">
          返回功能入口
        </Link>
      </header>

      <section className="simulator-layout">
        <aside className="sim-side-panel">
          <div className="panel-heading">
            <span className="panel-number">03</span>
            <div>
              <h2>{diagnosisCase.title}</h2>
              <p>{diagnosisCase.subtitle}</p>
            </div>
          </div>

          <div className="brief-block">
            <span>任务</span>
            <p>{diagnosisCase.scenario}</p>
          </div>

          <div className="sim-checklist">
            {inspectItems.map((item, index) => (
              <button
                className={`sim-check ${
                  activeInspect === item.id ? "active" : ""
                } ${inspected.has(item.id) ? "done" : ""}`}
                key={item.id}
                type="button"
                onClick={() => inspect(item.id)}
              >
                <span>{index + 1}</span>
                <strong>{item.title}</strong>
              </button>
            ))}
          </div>

          <div className="safety-card">
            <strong>安全状态</strong>
            <ul>
              <li>检修状态压板：已投入</li>
              <li>跳闸出口压板：已退出</li>
              <li>合闸出口压板：已退出</li>
            </ul>
          </div>
        </aside>

        <section className="sim-board-panel">
          <div className="sim-toolbar">
            <div>
              <span className={`sim-state-dot ${testState}`} />
              {actionResult}
            </div>
            <div className="sim-toolbar-actions">
              <button className="secondary-button compact" type="button" onClick={resetSimulator}>
                复位
              </button>
              <button className="primary-button compact" type="button" onClick={runTest}>
                开始试验
              </button>
            </div>
          </div>

          <div className={`sim-board ${testState}`}>
            <div className="sim-device tester">
              <span>微机保护测试仪</span>
              <strong>3I0 2.10A</strong>
              <small>持续 1.70s</small>
            </div>

            <div className="sim-device terminal" onClick={() => inspect("wiring")}>
              <span>外接零序端子</span>
              <strong>IN 回路</strong>
              <small>接线正常</small>
            </div>

            <div className="sim-device relay" onClick={() => inspect("sampling")}>
              <span>保护装置</span>
              <strong>采样 3I0=2.09A</strong>
              <small>零序Ⅲ段启动检查</small>
            </div>

            <button
              className={`sim-plate ${softPlateIn ? "in" : "out"}`}
              type="button"
              onClick={() => {
                setSoftPlateIn((current) => !current);
                inspect("enable");
                setMessage(
                  softPlateIn
                    ? "零序Ⅲ段软压板已退出。"
                    : "零序Ⅲ段软压板已投入，可以重新试验。"
                );
              }}
            >
              <span>零序Ⅲ段软压板</span>
              <strong>{softPlateIn ? "投入" : "退出"}</strong>
            </button>

            <div className="sim-device logic" onClick={() => inspect("enable")}>
              <span>保护逻辑</span>
              <strong>{softPlateIn ? "条件满足" : "条件中断"}</strong>
              <small>硬压板/控制字已投入</small>
            </div>

            <div className="sim-device breaker">
              <span>断路器</span>
              <strong>{testState === "success" ? "跳闸命令到达" : "未动作"}</strong>
              <small>{testState === "success" ? "出口链路导通" : "等待出口"}</small>
            </div>

            <div className="sim-wire wire-1" />
            <div className="sim-wire wire-2" />
            <div className="sim-wire wire-3" />
            <div className="sim-wire wire-4" />
            <div className="sim-wire wire-5" />

            {testState !== "idle" && <div className="signal-pulse pulse-1" />}
            {testState !== "idle" && <div className="signal-pulse pulse-2" />}
            {testState !== "idle" && <div className="signal-pulse pulse-3" />}
            {testState === "success" && <div className="signal-pulse pulse-4" />}
            {testState === "success" && <div className="signal-pulse pulse-5" />}
          </div>
        </section>

        <aside className="sim-info-panel">
          <div className="panel-heading">
            <span className="panel-number">AI</span>
            <div>
              <h2>引导提示</h2>
              <p>根据老师流程给出观察方向</p>
            </div>
          </div>

          <div className="guide-card">
            <strong>{activeItem.title}</strong>
            <p>{activeItem.value}</p>
            <p>{activeItem.note}</p>
          </div>

          <div className="guide-card">
            <strong>当前提示</strong>
            <p>{message}</p>
          </div>

          <div className="score-card">
            <span>已检查项目</span>
            <strong>{inspectedCount} / {inspectItems.length}</strong>
            <p>建议按定值、测试仪、采样、接线、投入状态的顺序排查。</p>
          </div>

          {reportVisible ? (
            <div className="sim-report">
              <span>诊断结论</span>
              <h3>{diagnosisCase.presetCause}</h3>
              <p>
                定值、测试仪、采样和接线均正常；投入零序Ⅲ段软压板后复测，
                保护动作链路恢复正常。
              </p>
            </div>
          ) : null}
        </aside>
      </section>
      <ChaoxingDigitalHuman />
    </main>
  );
}
