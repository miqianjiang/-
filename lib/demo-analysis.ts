import type { DrawingAnalysis, Selection } from "./types";
import { getCaseRegion } from "./drawing-cases";

export function createDemoAnalysis(
  selection: Selection,
  caseId?: string,
  fileName?: string
): DrawingAnalysis {
  const region = getCaseRegion(caseId, fileName, selection);
  const sourceCopy = region
    ? {
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
      }[region.knowledgeSource]
    : null;

  if (region) {
    const copy = sourceCopy!;
    return {
      mode: "demo",
      sourceType: region.knowledgeSource,
      sourceLabel: copy.label,
      sourceNote: copy.note,
      title: `${region.title}（演示结果）`,
      recognizedText: region.keywords.slice(0, 10),
      componentType: region.componentType,
      functionDescription: region.functionDescription,
      circuitRelation: region.circuitRelation,
      actionLogic: region.actionLogic,
      safetyNotes: region.safetyNotes,
      caseRegion: region.title,
      textbookHint: region.textbookHint,
      learningGuide: region.learningGuide,
      confidence: region.knowledgeSource === "teacher" ? "高" : "中",
      disclaimer:
        "当前显示的是基于后台案例依据生成的演示内容；正式使用时还会结合框选区域的 OCR 与视觉识别结果。"
    };
  }

  return {
    mode: "demo",
    sourceType: "ai",
    sourceLabel: "AI 补充",
    sourceNote: "教材中未检索到直接对应内容，以下为基于图中可见信息的辅助解释。",
    title: "局部图纸解读（演示结果）",
    recognizedText: ["端子", "回路", "压板", "接点"],
    componentType: "线路保护装置二次图纸局部区域",
    functionDescription:
      "该区域属于线路保护装置二次图纸，需要结合图纸标题、端子号和相邻回路判断具体功能。",
    circuitRelation:
      "建议先确认它属于交流量输入、开关量输入、开关量输出还是屏柜/面板布置，再沿端子和连接线分析。",
    actionLogic:
      "动作逻辑需要结合完整图纸、接点状态和装置说明，不能只凭局部符号直接下结论。",
    safetyNotes: ["AI 识别结果需由专业教师核验。"],
    textbookHint:
      "教材中未检索到直接对应内容。可以先按通用二次图识读方法，从图纸标题、装置型号、端子号和连接线入手分析。",
    learningGuide: [
      "先确认图纸标题、装置型号和回路名称。",
      "再找出被框选区域内的端子号、接点代号和连接线。",
      "最后结合完整图纸判断它属于电源、开入、开出、跳闸、合闸还是信号回路。"
    ],
    confidence: "中",
    disclaimer: "当前未配置模型 API，显示的是案例演示内容。"
  };
}
