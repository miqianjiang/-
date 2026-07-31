import Link from "next/link";

const assistantUrl =
  "https://robot.chaoxing.com/prime?unitId=1275&robotId=7b338884debd4d9996745d126772ee98";

export default function AssistantPage() {
  return (
    <main className="app-shell assistant-shell">
      <header className="topbar">
        <div className="brand-mark">继保</div>
        <div>
          <p className="eyebrow">线路保护理实一体化实训平台</p>
          <h1>AI助教</h1>
        </div>
        <Link className="topbar-link" href="/">
          返回功能入口
        </Link>
      </header>

      <section className="assistant-frame-wrap">
        <iframe
          className="assistant-frame"
          src={assistantUrl}
          title="超星AI助教"
          allow="clipboard-write; microphone; camera"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </section>
    </main>
  );
}
