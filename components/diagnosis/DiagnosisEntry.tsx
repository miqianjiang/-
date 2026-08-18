"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { protectionCases } from "@/lib/protection-logic/cases";
import type { ProtectionCase } from "@/lib/protection-logic/types";

const guidePrompts: Array<{ label: string; caseId: string }> = [
  { label: "排查零序过流保护Ⅲ段故障", caseId: "zero-sequence-stage-three" },
  { label: "排查距离Ⅱ段动作异常", caseId: "distance-stage-two" },
  { label: "排查重合闸充电异常", caseId: "reclosing-logic" },
  { label: "排查过流Ⅰ段启动异常", caseId: "over-current-stage-one" }
];

const caseMeta = {
  zeroSequenceStageThree: {
    accent: "zero",
    tag: "案例一",
    tone: "投入、启动、延时、动作"
  },
  distanceStageTwo: {
    accent: "distance",
    tag: "案例二",
    tone: "阻抗判据与 TV 复归"
  },
  reclosingCharge: {
    accent: "reclose",
    tag: "案例三",
    tone: "15s 充电与闭锁条件"
  },
  overcurrentStageOne: {
    accent: "over",
    tag: "案例四",
    tone: "方向、低压闭锁与电流判据"
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
  const [pendingCase, setPendingCase] = useState<ProtectionCase | null>(null);
  const matchTimer = useRef<number | null>(null);
  const matchedCase = useMemo(() => matchCaseByQuery(query), [query]);

  useEffect(() => {
    return () => {
      if (matchTimer.current) {
        window.clearTimeout(matchTimer.current);
      }
    };
  }, []);

  function goToCase(nextCase: ProtectionCase | null, nextQuery = query) {
    if (!nextCase) return;
    if (matchTimer.current) {
      window.clearTimeout(matchTimer.current);
    }
    setQuery(nextQuery);
    setPendingCase(nextCase);
    setIsMatching(true);
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
      <header className="topbar diagnosis-entry-topbar">
        <div className="brand-mark">继保</div>
        <div>
          <p className="eyebrow">功能3 · 故障排查智能引导</p>
          <h1>故障排查智能引导</h1>
        </div>
        <Link className="topbar-link" href="/">
          返回功能入口
        </Link>
      </header>

      <section className="diagnosis-entry-main">
        <div className="diagnosis-chat-panel">
          <div className="assistant-card">
            <span>AI 排查助手</span>
            <h2>说明你的故障现象</h2>
            <p>输入故障现象、保护名称、判据或现场问题，我会识别对应案例，并进入故障排查页面。</p>
            <form className="chat-case-input" onSubmit={submitQuery}>
              <label className="sr-only" htmlFor="diagnosis-case-query">输入故障现象或问题</label>
              <div className="chat-input-shell">
                <input
                  id="diagnosis-case-query"
                  disabled={isMatching}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="例如：零序保护不动作、距离Ⅱ段异常、重合闸未充电、过流Ⅰ段未启动"
                  value={query}
                />
                <button disabled={!matchedCase || isMatching} type="submit">
                  {isMatching ? "匹配中" : "进入"}
                </button>
              </div>
              <div className={`match-inline-status ${isMatching ? "loading" : matchedCase ? "matched" : ""}`}>
                {isMatching ? <span className="mini-spinner" aria-hidden="true" /> : null}
                <p>
                  {isMatching && pendingCase
                    ? `AI 正在匹配：${pendingCase.shortTitle}，即将进入故障排查页面。`
                    : query
                      ? matchedCase
                        ? `已匹配：${matchedCase.shortTitle}，按回车进入排查。`
                        : "暂未匹配到案例，可尝试输入零序、距离、重合闸或过流。"
                      : "输入关键词后，系统会自动匹配对应案例。"}
                </p>
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
          {protectionCases.map((item, index) => {
            const meta = caseMeta[item.logicType];
            return (
              <Link className={`diagnosis-case-card ${meta.accent}`} href={`/diagnosis/${item.id}`} key={item.id}>
                <div className="case-card-head">
                  <div className="case-index">{String(index + 1).padStart(2, "0")}</div>
                  <span>{meta.tag}</span>
                </div>
                <div>
                  <span>{meta.tone}</span>
                  <h2>{item.shortTitle}</h2>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
