import Link from "next/link";

const assistantUrl =
  "https://robot.chaoxing.com/prime?unitId=1275&robotId=7b338884debd4d9996745d126772ee98";

const modules = [
  {
    title: "课程AI助教",
    tag: "功能1",
    description: "跳转至课程AI助教，支持学生围绕线路保护知识进行问答学习。",
    href: assistantUrl,
    external: true,
    disabled: false
  },
  {
    title: "图纸解读训练",
    tag: "功能2",
    description: "基于典型保护图纸进行局部框选识读，辅助理解端子、压板和二次回路关系。",
    href: "/drawing",
    external: false,
    disabled: false
  },
  {
    title: "保护逻辑动态推演",
    tag: "功能3",
    description: "将静态零序过流保护Ⅲ段动作逻辑图转化为可交互模型，实时观察投入、启动、延时、动作和复归过程。",
    href: "/diagnosis",
    external: false,
    disabled: false
  }
];

export default function Home() {
  return (
    <main className="app-shell home-shell">
      <header className="topbar">
        <div className="brand-mark">继保</div>
        <div>
          <p className="eyebrow">线路保护理实一体化实训平台</p>
          <h1>线路保护智能训练平台</h1>
        </div>
        <span className="version-badge">教师测试版</span>
      </header>

      <section className="home-workbench">
        <div className="home-intro">
          <span>教师测试版本</span>
          <h2>面向线路保护课程的智能化训练入口</h2>
          <p>
            本版本用于预览课程AI助教、图纸解读训练和保护逻辑推演训练的整体流程，便于教师测试案例内容、交互逻辑和教学适配度。
          </p>
        </div>

        <div className="module-grid">
          {modules.map((module) =>
            module.disabled ? (
              <div className="module-card disabled" key={module.title}>
                <span>{module.tag}</span>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
                <strong>待嵌入</strong>
              </div>
            ) : module.external ? (
              <a
                className="module-card"
                href={module.href}
                key={module.title}
                rel="noreferrer"
                target="_blank"
              >
                <span>{module.tag}</span>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
                <strong>打开助教</strong>
              </a>
            ) : (
              <Link className="module-card" href={module.href} key={module.title}>
                <span>{module.tag}</span>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
                <strong>进入训练</strong>
              </Link>
            )
          )}
        </div>
      </section>
    </main>
  );
}
