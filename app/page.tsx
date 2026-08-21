import Link from "next/link";
import ChaoxingDigitalHuman from "@/components/ChaoxingDigitalHuman";

const assistantUrl =
  "https://robot.chaoxing.com/prime?unitId=1275&robotId=53b6aaebaaf5447f9c040aa5aab640e5";

const modules = [
  {
    title: "课程AI助教",
    tag: "功能1",
    icon: "AI",
    image: "/home/home-assistant.png",
    imageAlt: "课程 AI 助教角色",
    description: "提问课程知识、保护原理和设备结构，获得面向课堂学习的解释。",
    href: assistantUrl,
    external: true,
    action: "打开助教"
  },
  {
    title: "图纸智能解读",
    tag: "功能2",
    icon: "DW",
    badge: "课堂推荐",
    image: "/home/home-drawing.png",
    imageAlt: "图纸智能解读角色",
    description: "选择案例图纸或上传本地图纸，框选端子、压板、接点或局部回路进行识读训练。",
    href: "/drawing",
    external: false,
    action: "进入训练"
  },
  {
    title: "故障排查智能引导",
    tag: "功能3",
    icon: "LG",
    image: "/home/home-diagnosis.png",
    imageAlt: "故障排查智能引导角色",
    description: "输入故障现象，系统匹配典型保护案例，并通过动态逻辑图定位不动作原因。",
    href: "/diagnosis",
    external: false,
    action: "进入排查"
  }
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

export default function Home() {
  return (
    <div className="home-page">
      <header className="home-nav" aria-label="平台导航">
        <div className="home-brand">
          <div className="home-brand-mark">继保</div>
          <div>
            <strong>线路保护理实一体化智能助教</strong>
          </div>
        </div>
      </header>

      <main className="home-main">
        <section className="home-hero">
          <h1>线路保护理实一体化智能助教</h1>
          <span>
            面向线路保护理实一体化课程，整合 AI 问答、图纸智能解读与故障排查智能引导，帮助学生完成从知识理解到故障排查的完整训练闭环。
          </span>
        </section>

        <section className="home-grid">
          <section className="home-notice-ribbon" aria-label="课程提示">
            {notices.map((notice) => (
              <article className={`home-notice ${notice.tone}`} key={notice.title}>
                <i />
                <div>
                  <strong>{notice.title}</strong>
                  <p>{notice.text}</p>
                </div>
              </article>
            ))}
          </section>

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
        </section>
      </main>

      <footer className="home-footer">
        <span>© 2026 线路保护理实一体化智能助教</span>
        <div>
          <span>教学诚信</span>
          <span>继电保护</span>
          <span>安全第一</span>
        </div>
      </footer>
      <ChaoxingDigitalHuman />
    </div>
  );
}

function ModuleCard({
  module
}: {
  module: {
    title: string;
    icon: string;
    image: string;
    imageAlt: string;
    badge?: string;
    description: string;
    action: string;
  };
}) {
  return (
    <>
      <div className="home-module-visual">
        <img src={module.image} alt={module.imageAlt} />
        <span className="home-module-icon">{module.icon}</span>
        {module.badge ? <em className="home-module-tag">{module.badge}</em> : null}
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
