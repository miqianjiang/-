import { NextRequest, NextResponse } from "next/server";
import { createDemoAnalysis } from "@/lib/demo-analysis";
import { getCaseRegion } from "@/lib/drawing-cases";
import type { DrawingAnalysis, Selection } from "@/lib/types";

type AnalyzeRequest = {
  imageDataUrl?: string;
  selection?: Selection;
  fileName?: string;
  pageNumber?: number;
  caseId?: string;
};

type ChatMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
    };

async function chatCompletion({
  baseUrl,
  apiKey,
  model,
  messages,
  jsonMode = false
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  jsonMode?: boolean;
}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {})
    }),
    signal: AbortSignal.timeout(90_000)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`模型调用失败（${response.status}）：${detail.slice(0, 180)}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("模型没有返回可用内容");
  }
  return content;
}

function parseJsonObject<T>(content: string): T {
  const clean = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("模型返回格式不是 JSON");
  return JSON.parse(clean.slice(start, end + 1)) as T;
}

function normalizeAnalysis(
  raw: Partial<DrawingAnalysis>,
  caseRegion?: ReturnType<typeof getCaseRegion>
): DrawingAnalysis {
  const sourceType = caseRegion?.knowledgeSource ?? "ai";
  const confidence = sourceType === "teacher"
    ? "高"
    : ["高", "中", "低"].includes(raw.confidence ?? "")
    ? raw.confidence!
    : "低";
  const sourceCopy = {
    teacher: {
      label: "教师注释",
      note: "已匹配老师提供的标准图纸注释，优先按教师注释解释。"
    },
    textbook: {
      label: "教材内容",
      note: "已匹配本地案例知识库，提示内容来自老师提供的教材与案例整理。"
    },
    ai: {
      label: "AI 补充",
      note: "教材中未检索到直接对应内容，以下为基于图中可见信息的辅助解释。"
    }
  }[sourceType];

  return {
    mode: "live",
    sourceType,
    sourceLabel: sourceCopy.label,
    sourceNote: sourceCopy.note,
    title: caseRegion?.title || raw.title || "局部图纸解读",
    recognizedText: Array.isArray(raw.recognizedText)
      ? raw.recognizedText.slice(0, 20)
      : caseRegion?.keywords.slice(0, 10) ?? [],
    componentType: caseRegion?.componentType || raw.componentType || "暂未确定",
    functionDescription: caseRegion?.functionDescription || raw.functionDescription || "暂无可靠结论",
    circuitRelation: caseRegion?.circuitRelation || raw.circuitRelation || "需要结合完整图纸进一步核对",
    actionLogic: caseRegion?.actionLogic || raw.actionLogic || "需要结合接点状态进一步核对",
    safetyNotes: caseRegion?.safetyNotes ?? [
      "本结果只用于识图训练，不作为真实设备操作依据。",
      "涉及跳闸、合闸、防跳等关键回路时，需结合完整图纸核对。"
    ],
    caseRegion: raw.caseRegion,
    textbookHint:
      caseRegion?.textbookHint ||
      raw.textbookHint ||
      "教材中未检索到直接对应内容。可以先按通用二次图识读方法，从图纸标题、装置型号、端子号和连接线入手分析。",
    learningGuide:
      caseRegion?.learningGuide ||
      (Array.isArray(raw.learningGuide) ? raw.learningGuide.slice(0, 3) : [
        "先确认图纸标题、装置型号和回路名称。",
        "再找出被框选区域内的端子号、接点代号和连接线。",
        "最后结合完整图纸判断它属于电源、开入、开出、跳闸、合闸还是信号回路。"
      ]),
    confidence,
    disclaimer:
      "本结果由百炼 OCR、视觉模型和后台案例依据生成，仅用于教学，不得作为现场操作依据。"
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalyzeRequest;
    if (
      !body.imageDataUrl?.startsWith("data:image/") ||
      !body.selection
    ) {
      return NextResponse.json(
        { error: "缺少有效的框选图像或区域信息。" },
        { status: 400 }
      );
    }

    const dashscopeKey = process.env.DASHSCOPE_API_KEY;
    const caseRegion = getCaseRegion(body.caseId, body.fileName, body.selection);

    if (!dashscopeKey) {
      return NextResponse.json({
        analysis: createDemoAnalysis(body.selection, body.caseId, body.fileName)
      });
    }

    const dashscopeBase =
      process.env.DASHSCOPE_BASE_URL ??
      "https://dashscope.aliyuncs.com/compatible-mode/v1";
    const ocrModel = process.env.QWEN_OCR_MODEL ?? "qwen3.5-ocr";
    const visionModel = process.env.QWEN_VISION_MODEL ?? "qwen3.6-flash";
    const explanationModel =
      process.env.QWEN_EXPLANATION_MODEL ?? "qwen3.6-flash";

    const [ocrText, visualText] = await Promise.all([
      chatCompletion({
        baseUrl: dashscopeBase,
        apiKey: dashscopeKey,
        model: ocrModel,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "请高精度提取这张继电保护局部图中的所有文字、端子号、设备代号和数值。保持原文，不要补写看不清的内容。"
              },
              { type: "image_url", image_url: { url: body.imageDataUrl } }
            ]
          }
        ]
      }),
      chatCompletion({
        baseUrl: dashscopeBase,
        apiKey: dashscopeKey,
        model: visionModel,
        jsonMode: true,
        messages: [
          {
            role: "system",
            content:
              "你是继电保护图纸视觉识别助手。只分析可见证据，不确定时明确说明，不得编造端子号和设备功能。"
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "分析框选的局部电气图。以 JSON 返回：visible_symbols（数组）、likely_component、visible_connections、uncertainties（数组）。"
              },
              { type: "image_url", image_url: { url: body.imageDataUrl } }
            ]
          }
        ]
      })
    ]);

    const finalText = await chatCompletion({
      baseUrl: dashscopeBase,
      apiKey: dashscopeKey,
      model: explanationModel,
      jsonMode: true,
      messages: [
        {
          role: "system",
          content:
            "你是《线路保护装置运维及检验》课程助教。当前学生端只展示图纸。若提供了教师标准注释，必须优先按教师注释解释；其次使用本地教材依据；若未提供直接对应依据，可基于图中可见信息和通用继电保护知识进行 AI 补充。涉及安全的结论必须保守，不得给出真实设备操作指令。输出必须是 JSON。"
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "根据 OCR、视觉识别结果与可用的教师注释、本地案例/教材依据生成结构化图纸解读。教师注释是最高优先级标准答案，不要被 OCR 或视觉模型改写跑偏。不要把推测写成事实；如果没有直接教师注释或教材依据，可以生成 AI 补充，但需保持保守。不要输出模型识别过程说明；如果证据不足，只在对应解释中简短说明需要结合完整图纸核对。",
            source: {
              caseId: body.caseId,
              fileName: body.fileName,
              pageNumber: body.pageNumber,
              ocrText,
              visualResult: visualText,
              caseRegion
            },
            outputSchema: {
              title: "string",
              recognizedText: ["string"],
              componentType: "string",
              functionDescription: "string",
              circuitRelation: "string",
              actionLogic: "string",
              caseRegion: "string",
              textbookHint: "string",
              learningGuide: ["string"],
              confidence: "高|中|低"
            }
          })
        }
      ]
    });

    const analysis = normalizeAnalysis(
      parseJsonObject<Partial<DrawingAnalysis>>(finalText),
      caseRegion
    );
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI 解读过程中出现未知错误。"
      },
      { status: 502 }
    );
  }
}
