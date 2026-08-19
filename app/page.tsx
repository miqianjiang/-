import Link from "next/link";

const assistantUrl =
  "https://robot.chaoxing.com/prime?unitId=1275&robotId=7b338884debd4d9996745d126772ee98";

const modules = [
  {
    title: "课程AI助教",
    tag: "功能1",
    icon: "AI",
    description: "提问课程知识、保护原理和设备结构，获得面向课堂学习的解释。",
    href: assistantUrl,
    external: true,
    action: "打开助教"
  },
  {
    title: "图纸解读训练",
    tag: "功能2",
    icon: "DW",
    badge: "课堂推荐",
    description: "选择案例图纸或上传本地图纸，框选端子、压板、接点或局部回路进行识读训练。",
    href: "/drawing",
    external: false,
    action: "进入训练"
  },
  {
    title: "故障排查智能引导",
    tag: "功能3",
    icon: "LG",
    description: "输入故障现象，系统匹配典型保护案例，并通过动态逻辑图定位不动作原因。",
    href: "/diagnosis",
    external: false,
    action: "进入排查"
  }
];

const overview = [
  { value: "3", label: "训练模块", detail: "问答 / 识图 / 排查", tone: "blue" },
  { value: "2", label: "图纸案例", detail: "CSC-211 与 PSL641U", tone: "cyan" },
  { value: "4", label: "逻辑案例", detail: "覆盖典型保护链路", tone: "green" },
  { value: "AI", label: "辅助讲解", detail: "已接入课程", tone: "amber" }
];

const notices = [
  {
    tone: "warning",
    title: "教学安全声明",
    text: "AI 讲解仅用于课程训练，关键结论需教师核验。"
  },
  {
    tone: "primary",
    title: "推荐课堂路径",
    text: "建议按问答、识图、推演完成一次训练闭环。"
  },
  {
    tone: "success",
    title: "学生学习提示",
    text: "遇到不理解的端子或逻辑节点，先框选识读，再回到推演页验证。"
  }
];

const activities = [
  {
    active: true,
    title: "已接入图纸案例",
    time: "CSC-211 / PSL641U"
  },
  {
    active: false,
    title: "已接入保护逻辑",
    time: "零序Ⅲ段、距离Ⅱ段、重合闸、过流Ⅰ段"
  },
  {
    active: false,
    title: "AI 链路状态",
    time: "已接入课程 / 百炼模型可配置"
  }
];

export default function Home() {
  return (
    <div className="home-page">
      <header className="home-nav" aria-label="平台导航">
        <div className="home-brand">
          <div className="home-brand-mark">继保</div>
          <div>
            <span>线路保护理实一体化实训平台</span>
            <strong>线路保护智能训练平台</strong>
          </div>
        </div>
      </header>

      <main className="home-main">
        <section className="home-hero">
          <p>线路保护智能实训</p>
          <h1>线路保护智能化实训教学平台</h1>
          <span>
            面向线路保护理实一体化课程，整合 AI 问答、图纸识读与保护逻辑推演，帮助学生完成从知识理解到故障排查的完整训练闭环。
          </span>
        </section>

        <section className="home-grid">
          <div className="home-row home-row-top">
            <div className="home-module-grid" aria-label="核心功能入口">
              {modules.map((module) =>
                module.external ? (
                  <a
                    className={module.badge ? "home-module-card featured" : "home-module-card"}
                    href={module.href}
                    key={module.title}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ModuleCard module={module} />
                  </a>
                ) : (
                  <Link
                    className={module.badge ? "home-module-card featured" : "home-module-card"}
                    href={module.href}
                    key={module.title}
                  >
                    <ModuleCard module={module} />
                  </Link>
                )
              )}
            </div>

            <section className="home-side-card">
              <div className="home-side-head">
                <h2>课程提示</h2>
                <span>NT</span>
              </div>
              <div className="home-notice-list">
                {notices.map((notice) => (
                  <article className={`home-notice ${notice.tone}`} key={notice.title}>
                    <i />
                    <div>
                      <strong>{notice.title}</strong>
                      <p>{notice.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <div className="home-row home-row-bottom">
            <section className="home-overview-card">
              <h2>训练能力概览</h2>
              <div className="home-overview-grid">
                {overview.map((item) => (
                  <div className={`home-overview-item ${item.tone}`} key={item.label}>
                    <i aria-hidden="true" />
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                    <p>{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="home-side-card">
              <div className="home-side-head">
                <h2>平台状态</h2>
                <span>HS</span>
              </div>
              <div className="home-activity-list">
                {activities.map((activity) => (
                  <article className={activity.active ? "active" : ""} key={activity.title}>
                    <i />
                    <div>
                      <strong>{activity.title}</strong>
                      <span>{activity.time}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <span>© 2026 线路保护智能训练平台</span>
        <div>
          <span>教学诚信</span>
          <span>继电保护</span>
          <span>安全第一</span>
        </div>
      </footer>
    </div>
  );
}

function ModuleCard({
  module
}: {
  module: {
    title: string;
    icon: string;
    badge?: string;
    description: string;
    action: string;
  };
}) {
  return (
    <>
      <div className="home-module-icon">{module.icon}</div>
      <div className="home-module-meta">
        {module.badge ? <em>{module.badge}</em> : <em aria-hidden="true" className="ghost">占位</em>}
      </div>
      <h2>{module.title}</h2>
      <p>{module.description}</p>
      <strong>
        {module.action}
        <i aria-hidden="true">→</i>
      </strong>
    </>
  );
}
