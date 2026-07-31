"use client";

import { ChangeEvent, PointerEvent, useRef, useState } from "react";
import Link from "next/link";
import ChaoxingDigitalHuman from "@/components/ChaoxingDigitalHuman";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { drawingCases } from "@/lib/drawing-cases";
import type { DrawingAnalysis, Selection } from "@/lib/types";

type Point = { x: number; y: number };

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp"
];

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function normalizeSelection(start: Point, end: Point): Selection {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  };
}

export default function DrawingWorkbench() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<Point | null>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);

  const [fileName, setFileName] = useState("");
  const [caseId, setCaseId] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draftSelection, setDraftSelection] = useState<Selection | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loadingFile, setLoadingFile] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<DrawingAnalysis | null>(null);

  async function renderPdfPage(pdf: PDFDocumentProxy, targetPage: number) {
    const page = await pdf.getPage(targetPage);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器无法创建绘图画布");

    await page.render({ canvas, canvasContext: context, viewport }).promise;
  }

  async function loadPdf(file: File, initialPage = 1) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const data = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data }).promise;
    const safePage = Math.min(Math.max(initialPage, 1), pdf.numPages);
    pdfRef.current = pdf;
    setPageCount(pdf.numPages);
    setPageNumber(safePage);
    await renderPdfPage(pdf, safePage);
  }

  async function loadImage(file: File) {
    pdfRef.current = null;
    setPageCount(1);
    setPageNumber(1);

    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();

      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxDimension = 2600;
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("浏览器无法创建绘图画布");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function loadFile(file: File, initialPage = 1, nextCaseId = "") {
    setError("");
    setAnalysis(null);
    setSelection(null);
    setDraftSelection(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("请选择 PDF、PNG、JPG 或 WEBP 文件。");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("文件不能超过 20MB。");
      return;
    }

    setLoadingFile(true);
    setFileName(file.name);
    setCaseId(nextCaseId);
    try {
      if (file.type === "application/pdf") {
        await loadPdf(file, initialPage);
      } else {
        await loadImage(file);
      }
    } catch (loadError) {
      console.error(loadError);
      setFileName("");
      setError("图纸读取失败，请换用清晰的 PDF、PNG 或 JPG 文件。");
    } finally {
      setLoadingFile(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) await loadFile(file, 1, "");
    event.target.value = "";
  }

  async function loadCaseDrawing(nextCaseId: string) {
    const drawingCase = drawingCases.find((item) => item.id === nextCaseId);
    if (!drawingCase) return;

    setLoadingFile(true);
    setError("");
    try {
      const response = await fetch(drawingCase.fileUrl);
      if (!response.ok) throw new Error("示例文件不存在");
      const blob = await response.blob();
      await loadFile(
        new File([blob], drawingCase.fileName, {
          type: drawingCase.fileType
        }),
        1,
        drawingCase.id
      );
    } catch (sampleError) {
      console.error(sampleError);
      setError("案例图纸加载失败。");
      setLoadingFile(false);
    }
  }

  function pointFromEvent(event: PointerEvent<HTMLDivElement>): Point {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const rect = stage.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height)
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!fileName || loadingFile) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    dragStartRef.current = point;
    setAnalysis(null);
    setDraftSelection({ x: point.x, y: point.y, width: 0, height: 0 });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current;
    if (!start) return;
    setDraftSelection(normalizeSelection(start, pointFromEvent(event)));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current;
    if (!start) return;
    const nextSelection = normalizeSelection(start, pointFromEvent(event));
    dragStartRef.current = null;
    setDraftSelection(null);

    if (nextSelection.width < 0.02 || nextSelection.height < 0.02) {
      setSelection(null);
      setError("框选范围太小，请按住鼠标拖动选择一个完整符号或局部回路。");
      return;
    }

    setError("");
    setSelection(nextSelection);
  }

  async function changePage(nextPage: number) {
    const pdf = pdfRef.current;
    if (!pdf || nextPage < 1 || nextPage > pageCount) return;
    setLoadingFile(true);
    setSelection(null);
    setAnalysis(null);
    try {
      await renderPdfPage(pdf, nextPage);
      setPageNumber(nextPage);
    } finally {
      setLoadingFile(false);
    }
  }

  function cropSelection(): string {
    const canvas = canvasRef.current;
    if (!canvas || !selection) throw new Error("请先框选图纸区域");

    const sx = Math.round(selection.x * canvas.width);
    const sy = Math.round(selection.y * canvas.height);
    const sw = Math.max(1, Math.round(selection.width * canvas.width));
    const sh = Math.max(1, Math.round(selection.height * canvas.height));

    const crop = document.createElement("canvas");
    crop.width = sw;
    crop.height = sh;
    const context = crop.getContext("2d");
    if (!context) throw new Error("无法生成框选区域");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, sw, sh);
    context.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return crop.toDataURL("image/jpeg", 0.9);
  }

  async function analyzeSelection() {
    if (!selection) {
      setError("请先在图纸上拖动框选需要解读的区域。");
      return;
    }

    setAnalyzing(true);
    setError("");
    setAnalysis(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: cropSelection(),
          selection,
          fileName,
          pageNumber,
          caseId
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "AI 解读失败");
      }
      setAnalysis(payload.analysis);
    } catch (analysisError) {
      setError(
        analysisError instanceof Error ? analysisError.message : "AI 解读失败"
      );
    } finally {
      setAnalyzing(false);
    }
  }

  const visibleSelection = draftSelection ?? selection;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">继保</div>
        <div>
          <p className="eyebrow">线路保护理实一体化实训平台</p>
          <h1>保护屏柜图纸智能解读</h1>
        </div>
        <Link className="topbar-link" href="/">
          返回功能入口
        </Link>
      </header>

      <section className="step-strip" aria-label="操作步骤">
        <div className={fileName ? "step done" : "step active"}>
          <span>1</span>
          上传图纸
        </div>
        <div className={selection ? "step done" : fileName ? "step active" : "step"}>
          <span>2</span>
          框选局部
        </div>
        <div className={analysis ? "step done" : selection ? "step active" : "step"}>
          <span>3</span>
          智能解读
        </div>
      </section>

      <section className="workspace-grid">
        <aside className="control-panel">
          <div className="panel-heading">
            <span className="panel-number">01</span>
            <div>
              <h2>图纸文件</h2>
              <p>选择案例图纸或上传本地图纸</p>
            </div>
          </div>

          <div className="case-list">
            {drawingCases.map((drawingCase) => (
              <button
                className={caseId === drawingCase.id ? "case-button active" : "case-button"}
                key={drawingCase.id}
                type="button"
                onClick={() => loadCaseDrawing(drawingCase.id)}
              >
                <span>{drawingCase.title.replace("：", " · ")}</span>
                <small>{drawingCase.shortTitle}</small>
              </button>
            ))}
          </div>

          <label className="upload-button">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={handleFileChange}
            />
            <span className="upload-icon">↑</span>
            选择本地图纸
          </label>
          <div className="file-meta">
            <span>当前文件</span>
            <strong>{fileName || "尚未选择"}</strong>
          </div>

          {pageCount > 1 && (
            <div className="page-controls">
              <button
                type="button"
                onClick={() => changePage(pageNumber - 1)}
                disabled={pageNumber === 1}
              >
                上一页
              </button>
              <span>
                {pageNumber} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => changePage(pageNumber + 1)}
                disabled={pageNumber === pageCount}
              >
                下一页
              </button>
            </div>
          )}

          <div className="tip-card">
            <strong>框选建议</strong>
            <p>一次选择一个端子组、压板、插件、接点或局部回路，图纸区只保留学生需要观察的内容。</p>
          </div>

          <button
            className="clear-button"
            type="button"
            disabled={!selection}
            onClick={() => {
              setSelection(null);
              setAnalysis(null);
            }}
          >
            清除框选
          </button>
        </aside>

        <section className="drawing-panel">
          <div className="drawing-toolbar">
            <div>
              <span className="status-dot" />
              {loadingFile
                ? "正在读取图纸…"
                : fileName
                  ? "图纸已就绪，请拖动框选"
                  : "等待选择案例图纸"}
            </div>
            <span>{fileName ? `第 ${pageNumber} 页` : "A3 / A4 均可"}</span>
          </div>

          <div className="drawing-viewport">
            {!fileName && !loadingFile && (
              <div className="empty-state">
                <div className="empty-drawing-icon">⌗</div>
                <h2>选择一张案例图纸开始</h2>
                <p>学生端只显示图纸本身，教材内容作为后台依据参与解读。</p>
              </div>
            )}
            {loadingFile && <div className="loading-state">正在解析文件…</div>}
            <div
              ref={stageRef}
              className={`canvas-stage ${fileName ? "visible" : ""}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => {
                dragStartRef.current = null;
                setDraftSelection(null);
              }}
            >
              <canvas ref={canvasRef} />
              {visibleSelection && (
                <div
                  className="selection-box"
                  style={{
                    left: `${visibleSelection.x * 100}%`,
                    top: `${visibleSelection.y * 100}%`,
                    width: `${visibleSelection.width * 100}%`,
                    height: `${visibleSelection.height * 100}%`
                  }}
                >
                  <span>识别区域</span>
                </div>
              )}
            </div>
          </div>

          {error && <div className="error-banner">{error}</div>}

          <div className="drawing-actions">
            <p>
              {selection
                ? "已选中区域，可以开始智能解读。"
                : "按住鼠标或触控笔，在图纸上拖出一个矩形区域。"}
            </p>
            <button
              className="primary-button"
              type="button"
              disabled={!selection || analyzing}
              onClick={analyzeSelection}
            >
              {analyzing ? "正在识别与分析…" : "开始智能解读"}
            </button>
          </div>
        </section>

        <aside className="result-panel">
          <div className="panel-heading">
            <span className="panel-number">02</span>
            <div>
              <h2>解读结果</h2>
              <p>识别、逻辑与安全提示</p>
            </div>
          </div>

          {!analysis && !analyzing && (
            <div className="result-placeholder">
              <div>AI</div>
              <p>完成框选后，系统将在这里展示结构化专业解读。</p>
            </div>
          )}
          {analyzing && (
            <div className="analysis-progress">
              <div className="spinner" />
              <strong>正在分析局部图纸</strong>
              <span>识别文字 → 判断元件 → 生成教学解释</span>
            </div>
          )}
          {analysis && (
            <article className="analysis-card">
              <div className="analysis-title-row">
                <span className={`mode-tag ${analysis.mode}`}>
                  {analysis.mode === "live" ? "AI 实时结果" : "演示结果"}
                </span>
                <span className="confidence">可信度：{analysis.confidence}</span>
              </div>
              <div className={`source-banner ${analysis.sourceType}`}>
                <strong>{analysis.sourceLabel}</strong>
                <span>{analysis.sourceNote}</span>
              </div>
              <h3>{analysis.title}</h3>

              <ResultSection title="识别文字">
                <div className="token-list">
                  {analysis.recognizedText.map((text) => (
                    <span key={text}>{text}</span>
                  ))}
                </div>
              </ResultSection>
              <ResultSection title="元件/区域类型">
                <p>{analysis.componentType}</p>
              </ResultSection>
              <ResultSection title="主要作用">
                <p>{analysis.functionDescription}</p>
              </ResultSection>
              <ResultSection title="回路关系">
                <p>{analysis.circuitRelation}</p>
              </ResultSection>
              <ResultSection title="动作逻辑">
                <p>{analysis.actionLogic}</p>
              </ResultSection>
              {analysis.textbookHint ? (
                <ResultSection
                  title={
                    analysis.sourceType === "teacher"
                      ? "教师提示"
                      : analysis.sourceType === "textbook"
                        ? "课本提示"
                        : "AI 补充"
                  }
                >
                  <p>{analysis.textbookHint}</p>
                </ResultSection>
              ) : null}
              {analysis.learningGuide?.length ? (
                <ResultSection title="学习引导">
                  <ol className="guide-list">
                    {analysis.learningGuide.map((guide) => (
                      <li key={guide}>{guide}</li>
                    ))}
                  </ol>
                </ResultSection>
              ) : null}
              <ResultSection title="安全提示" warning>
                <ul>
                  {analysis.safetyNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </ResultSection>
              <p className="disclaimer">{analysis.disclaimer}</p>
            </article>
          )}
        </aside>
      </section>

      <footer className="safety-footer">
        <strong>教学安全声明</strong>
        <span>
          本系统用于课程学习与仿真训练，AI 结果需由专业教师核验，不得作为真实继电保护操作依据。
        </span>
      </footer>
      <ChaoxingDigitalHuman />
    </main>
  );
}

function ResultSection({
  title,
  warning = false,
  children
}: {
  title: string;
  warning?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`result-section ${warning ? "warning" : ""}`}>
      <h4>{title}</h4>
      {children}
    </section>
  );
}
