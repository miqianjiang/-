"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { protectionCases } from "@/lib/protection-logic/cases";
import type { ProtectionCase } from "@/lib/protection-logic/types";

const matchingStages = [
  { title: "识别故障现象", description: "提取关键词与保护现象" },
  { title: "匹配保护类型", description: "定位对应保护逻辑案例" },
  { title: "进入排查案例", description: "加载动态推演页面" }
];

const guidePrompts: Array<{ label: string; caseId: string }> = [
  { label: "零序保护不动作", caseId: "zero-sequence-stage-three" },
  { label: "距离Ⅱ段异常动作", caseId: "distance-stage-two" },
  { label: "跳闸后未重合", caseId: "reclosing-logic" },
  { label: "电流判据不满足", caseId: "over-current-stage-one" }
];

const caseMeta = {
  zeroSequenceStageThree: {
    accent: "zero",
    tag: "案例一",
    icon: "⚡",
    title: "零序保护Ⅲ段动作",
    symptom: "线路单相接地短路",
    criterion: "3I0 > I0.setⅢ 且 t > tⅢ",
    applies: "保护不动作 / 零序电流不足 / 延时未到"
  },
  distanceStageTwo: {
    accent: "distance",
    tag: "案例二",
    icon: "⌁",
    title: "距离保护Ⅱ段动作",
    symptom: "相间短路超越Ⅰ段范围",
    criterion: "Z < ZsetⅡ 且 t > tⅡ",
    applies: "异常跳闸 / 阻抗判据不满足 / TV断线复归"
  },
  reclosingCharge: {
    accent: "reclose",
    tag: "案例三",
    icon: "↻",
    title: "综合重合闸逻辑",
    symptom: "跳闸后重合闸充电或闭锁异常",
    criterion: "无闭锁信号且满足充电条件",
    applies: "跳闸后未重合 / 充电未完成 / 闭锁未解除"
  },
  overcurrentStageOne: {
    accent: "over",
    tag: "案例四",
    icon: "I",
    title: "过流Ⅰ段动作",
    symptom: "近端严重相间短路",
    criterion: "I > Iset，满足方向/低压闭锁条件",
    applies: "速断未启动 / 方向闭锁 / 电流定值不满足"
  }
};

function normalizeQuery(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[ⅰⅠ]/g, "i")
    .replace(/[ⅱⅡ]/g, "ii")
    .replace(/[ⅲⅢ]/g, "iii")
    .replace(/一段/g, "i段")
    .replace(/二段/g, "ii段")
    .replace(/三段/g, "iii段");
}

function matchCaseByQuery(query: string): ProtectionCase | null {
  const normalized = normalizeQuery(query);
  if (!normalized) return null;

  const keywordMap = [
    {
      caseId: "zero-sequence-stage-three",
      keywords: ["零序", "零序iii", "零序iii段", "零序3", "3i0", "i0.set", "三段"]
    },
    {
      caseId: "distance-stage-two",
      keywords: ["距离", "距离ii", "距离ii段", "接地距离", "阻抗", "z<zset", "tv"]
    },
    {
      caseId: "reclosing-logic",
      keywords: ["重合闸", "重合", "充电", "断路器合位", "15s", "闭锁"]
    },
    {
      caseId: "over-current-stage-one",
      keywords: ["过流", "过流i", "过流i段", "电流i段", "方向", "低压", "iset"]
    }
  ];

  const matched = keywordMap.find((item) =>
    item.keywords.some((keyword) => normalized.includes(normalizeQuery(keyword)))
  );

  if (matched) {
    return protectionCases.find((item) => item.id === matched.caseId) ?? null;
  }

  return (
    protectionCases.find((item) => {
      const title = normalizeQuery(`${item.title}${item.shortTitle}${item.description}`);
      return title.includes(normalized) || normalized.includes(normalizeQuery(item.shortTitle));
    }) ?? null
  );
}

export default function DiagnosisEntry() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isMatching, setIsMatching] = useState(false);
  const [matchStage, setMatchStage] = useState(0);
  const [pendingCase, setPendingCase] = useState<ProtectionCase | null>(null);
  const matchTimer = useRef<number | null>(null);
  const stageTimers = useRef<number[]>([]);
  const matchedCase = useMemo(() => matchCaseByQuery(query), [query]);

  useEffect(() => {
    return () => {
      if (matchTimer.current) {
        window.clearTimeout(matchTimer.current);
      }
      stageTimers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function goToCase(nextCase: ProtectionCase | null, nextQuery = query) {
    if (!nextCase) return;
    if (matchTimer.current) {
      window.clearTimeout(matchTimer.current);
    }
    stageTimers.current.forEach((timer) => window.clearTimeout(timer));
    stageTimers.current = [];
    setQuery(nextQuery);
    setPendingCase(nextCase);
    setMatchStage(0);
    setIsMatching(true);
    stageTimers.current = [
      window.setTimeout(() => setMatchStage(1), 900),
      window.setTimeout(() => setMatchStage(2), 1900)
    ];
    matchTimer.current = window.setTimeout(() => {
      router.push(`/diagnosis/${nextCase.id}`);
    }, 3000);
  }

  function submitQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    goToCase(matchedCase);
  }

  return (
    <main className="app-shell diagnosis-entry-shell">
      <header className="diagnosis-entry-nav">
        <div className="diagnosis-nav-inner">
          <Link className="diagnosis-nav-brand" href="/">
            <span className="diagnosis-nav-mark">继保</span>
            <span>
              <small>线路保护理实一体化实训平台</small>
              <strong>故障排查智能引导</strong>
            </span>
          </Link>
          <div className="diagnosis-nav-actions">
            <span className="diagnosis-case-count">已接入 {protectionCases.length} 个排查案例</span>
            <Link className="diagnosis-nav-action" href="/">
              返回功能入口
            </Link>
          </div>
        </div>
      </header>

      <section className="diagnosis-entry-main">
        <div className="diagnosis-chat-panel">
          <div className="assistant-card">
            <div className="assistant-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <circle cx="11" cy="11" r="6" />
                <path d="m16 16 4 4" />
              </svg>
            </div>
            <span>AI 诊断助手</span>
            <h2>说明你的故障现象</h2>
            <p>输入故障现象，快速定位保护动作逻辑</p>
            <form className="chat-case-input" onSubmit={submitQuery}>
              <label className="sr-only" htmlFor="diagnosis-case-query">输入故障现象或问题</label>
              <div className="chat-input-shell">
                <span className="search-symbol" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <circle cx="11" cy="11" r="6" />
                    <path d="m16 16 4 4" />
                  </svg>
                </span>
                <input
                  id="diagnosis-case-query"
                  disabled={isMatching}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="例如：保护压板已投入，但零序Ⅲ段没有动作"
                  value={query}
                />
                <button disabled={!matchedCase || isMatching} type="submit">
                  {isMatching ? "..." : "→"}
                </button>
              </div>
              <div className={`match-inline-status ${isMatching ? "loading" : matchedCase ? "matched" : ""}`}>
                {isMatching ? <span className="mini-spinner" aria-hidden="true" /> : null}
                {(query || isMatching) ? (
                  <div className="match-steps" aria-label="AI匹配进度">
                    {matchingStages.map((stage, index) => {
                      const statusClass = isMatching
                        ? index < matchStage
                          ? "done"
                          : index === matchStage
                            ? "active"
                            : ""
                        : matchedCase
                          ? "done"
                          : index === 0
                            ? "active"
                            : "";
                      return (
                        <span className={statusClass} key={stage.title}>
                          <i>{index < matchStage || (!isMatching && matchedCase) ? "✓" : index + 1}</i>
                          <b>{stage.title}</b>
                          <em>{stage.description}</em>
                        </span>
                      );
                    })}
                  </div>
                ) : null}
                {!isMatching && !matchedCase ? (
                  <p>
                    {query
                      ? "暂未匹配到案例，可尝试输入零序、距离、重合闸或过流。"
                      : "输入关键词后，系统会自动匹配对应案例。"}
                  </p>
                ) : null}
              </div>
            </form>
          </div>

          <div className="prompt-grid">
            {guidePrompts.map((prompt) => (
              <button
                key={prompt.label}
                type="button"
                onClick={() => {
                  const nextCase = protectionCases.find((item) => item.id === prompt.caseId) ?? null;
                  goToCase(nextCase, prompt.label);
                }}
              >
                {prompt.label}
              </button>
            ))}
          </div>

        </div>

        <div className="diagnosis-case-grid" aria-label="功能3推荐案例">
          <div className="case-grid-head">
            <span>推荐案例</span>
            <strong>也可以直接选择</strong>
          </div>
          {protectionCases.map((item) => {
            const meta = caseMeta[item.logicType];
            return (
              <Link className={`diagnosis-case-card ${meta.accent}`} href={`/diagnosis/${item.id}`} key={item.id}>
                <div className="case-card-watermark" aria-hidden="true">{meta.icon}</div>
                <div className="case-card-head">
                  <div className="case-icon" aria-hidden="true">{meta.icon}</div>
                  <h2>{meta.title}</h2>
                </div>
                <div>
                  <p><strong>现象：</strong>{meta.symptom}</p>
                  <p><strong>关键判据：</strong>{meta.criterion}</p>
                  <p className="case-apply"><strong>适用：</strong>{meta.applies}</p>
                </div>
                <span className="case-detail-link">进入排查 →</span>
              </Link>
            );
          })}
        </div>
      </section>
      <footer className="home-footer diagnosis-entry-footer">
        <span>© 2026 线路保护智能训练平台</span>
        <div>
          <span>教学安全</span>
          <span>故障排查</span>
          <span>教师核验</span>
        </div>
      </footer>
    </main>
  );
}
