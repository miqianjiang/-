import Link from "next/link";

const assistantUrl =
  "https://robot.chaoxing.com/prime?unitId=1275&robotId=7b338884debd4d9996745d126772ee98";

const modules = [
  {
    title: "AI助教入口",
    tag: "功能1",
    description: "跳转到超星AI助教，供学生进行课程问答与学习辅助。",
    href: assistantUrl,
    external: true,
    disabled: false
  },
  {
    title: "图纸解读训练",
    tag: "功能2",
    description: "加载案例图纸，框选端子、压板或局部回路，查看结构化解读。",
    href: "/drawing",
    external: false,
    disabled: false
  },
  {
    title: "故障诊断训练",
    tag: "功能3",
    description: "围绕零序过流保护Ⅲ段未动作案例，按标准流程逐步排查。",
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
          <h1>学生训练工作台</h1>
        </div>
        <span className="version-badge">本地原型</span>
      </header>

      <section className="home-workbench">
        <div className="home-intro">
          <span>请选择训练功能</span>
          <h2>把图纸识读和故障诊断放在同一个学生端入口里。</h2>
          <p>
            当前先跑通功能2和功能3。整体UI美化可以等流程稳定后再统一调整。
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
