import type { Selection } from "./types";

export type TeacherAnnotation = {
  id: string;
  title: string;
  keywords: string[];
  region: Selection;
  componentType: string;
  functionDescription: string;
  circuitRelation: string;
  actionLogic: string;
  commonMistake: string;
  safetyNotes: string[];
  textbookHint: string;
  learningGuide: string[];
};

export type DrawingCase = {
  id: string;
  title: string;
  shortTitle: string;
  fileName: string;
  fileUrl: string;
  fileType: "image/png";
  knowledgeSource: "textbook" | "ai";
  textbookScope: string;
  keywords: string[];
  componentType: string;
  functionDescription: string;
  circuitRelation: string;
  actionLogic: string;
  safetyNotes: string[];
  textbookBasis: string[];
  textbookHint: string;
  learningGuide: string[];
  teacherAnnotations?: TeacherAnnotation[];
};

export const drawingCases: DrawingCase[] = [
  {
    id: "csc211-switch-output",
    title: "案例一：CSC-211 开关量输出与跳合闸回路",
    shortTitle: "CSC-211 跳合闸回路",
    fileName: "CSC-211开关量输出与跳合闸回路.png",
    fileUrl: "/cases/csc211-switch-output.png",
    fileType: "image/png",
    knowledgeSource: "textbook",
    textbookScope: "教材图 1-7 及开关量输出回路说明",
    keywords: [
      "CSC-211",
      "1X7",
      "1X6",
      "1CD",
      "1Q2D",
      "STJ",
      "TBJ",
      "HBJ",
      "CKJ",
      "KKJ",
      "TWJ",
      "HWJ",
      "合闸",
      "跳闸",
      "防跳"
    ],
    componentType: "开关量输出、保护合闸、保护跳闸和手动/遥控跳合闸回路",
    functionDescription:
      "把保护装置输出命令送至断路器操作机构，实现合闸、跳闸、保持、防跳和位置监视等功能。",
    circuitRelation:
      "保护装置出口插件、逻辑插件、连接片、切换把手、继电器触点和断路器操作机构共同构成跳合闸控制链路。",
    actionLogic:
      "满足合闸或跳闸条件时，相应出口接点、继电器和导通元件动作，将控制电源送至操作机构或相关线圈。",
    safetyNotes: [
      "跳合闸回路属于关键二次控制回路，任何判断必须结合完整回路和接点状态。",
      "重点核对控制电源、出口压板、手动/遥控路径和防跳保持逻辑。"
    ],
    textbookBasis: [
      "教材图 1-7 为 CSC-211 线路保护装置开关量输出回路接点图。",
      "教材说明开关量输出回路主要包括合闸回路和跳闸回路。",
      "教材对保护合闸、手动合闸、遥控合闸和遥控跳闸路径进行了分段说明。"
    ],
    textbookHint:
      "课本这一段讲的是开关量输出回路。读图时可以把它理解成“保护装置发出命令后，怎样经过出口接点和继电器送到断路器操作机构”。",
    learningGuide: [
      "先找到控制电源 +KM 和 -KM。",
      "再沿着压板、把手、出口接点、继电器到操作机构画出一条路径。",
      "最后判断这条路径对应合闸、跳闸、保持、防跳还是位置监视。"
    ]
  },
  {
    id: "psl641u-contact",
    title: "案例二：PSL641U 接点联系图",
    shortTitle: "PSL641U 接点联系图",
    fileName: "PSL641U接点联系图.png",
    fileUrl: "/cases/psl641u-contact.png",
    fileType: "image/png",
    knowledgeSource: "ai",
    textbookScope: "同类线路保护跳合闸、防跳和位置监视回路知识",
    keywords: [
      "PSL641U",
      "1n6X3",
      "1n6X7",
      "1n6X12",
      "1D40",
      "1D41",
      "1D42",
      "TJ",
      "YTJ",
      "TBJ",
      "HBJ",
      "KKJ",
      "TWJ",
      "HWJ",
      "防跳回路"
    ],
    componentType: "PSL641U 保护装置接点、端子与断路器操作回路联系区域",
    functionDescription:
      "展示保护装置输出接点、连接片、端子排和断路器跳合闸操作回路之间的联系。",
    circuitRelation:
      "装置接点经端子排接入外部跳闸、合闸、保持、位置监视和防跳相关回路，右侧功能栏用于标示回路用途。",
    actionLogic:
      "保护或操作条件满足时，对应接点动作，使跳闸、合闸或保持回路获得控制电源；辅助接点和防跳元件用于状态反馈与闭锁。",
    safetyNotes: [
      "需要先核对图纸编号、装置型号、端子号和外部回路名称。",
      "PSL641U 图纸目前以图面证据和同类线路保护知识辅助解释，关键结论需教师确认。"
    ],
    textbookBasis: [
      "后台教材提供线路保护装置跳合闸、位置监视、防跳和端子编号识读的一般知识。",
      "该图为 PSL641U 接点联系图，和 CSC-211 图 1-7 同属线路保护二次操作回路识图训练对象。",
      "解释时应优先依据图中可见端子号、接点代号和右侧回路功能栏，不把同类装置知识直接当作该装置事实。"
    ],
    textbookHint:
      "课本中讲到的跳合闸、位置监视和防跳回路，可以帮助你读这张接点联系图。看图时要先相信图面证据，再用课本知识判断它属于哪类回路。",
    learningGuide: [
      "先圈出保护装置 PSL641U 的边界。",
      "再找出被框选接点连接到的端子号。",
      "最后对照右侧功能栏判断它属于跳闸、合闸、位置监视还是防跳回路。"
    ],
    teacherAnnotations: [
      {
        id: "psl641u-protection-trip",
        title: "保护跳闸回路",
        keywords: ["TJ", "1CLP1", "1D30", "1D40", "1n6X11", "跳闸出口压板"],
        region: { x: 0.17, y: 0.15, width: 0.34, height: 0.25 },
        componentType: "保护跳闸回路",
        functionDescription: "将保护跳闸命令发送至断路器。",
        circuitRelation:
          "微机保护装置检测到系统故障后，TJ 接点闭合；当 1CLP1 跳闸出口压板投入时，正电源由 1D30 端子经 TJ 接点、1CLP1 压板和 1D40 端子，进入装置 1n6X11 桩头，使断路器跳闸回路接通。",
        actionLogic:
          "保护动作且跳闸出口压板投入时，跳闸回路导通，跳闸命令送至断路器机构，使断路器跳开。",
        commonMistake:
          "1CLP1 跳闸出口压板退出时，即使保护动作，跳闸回路仍然断开；整组传动试验中断路器无法跳闸时，应重点检查 1CLP1 是否投入。",
        safetyNotes: [
          "做保护逻辑检验时，应退出 1CLP1 跳闸出口压板。",
          "避免检验过程中断路器频繁跳闸，影响一次开关场检修安全。"
        ],
        textbookHint:
          "老师注释把这里归为保护跳闸回路。读图时重点看 TJ 接点、1CLP1 跳闸出口压板和 1D30、1D40、1n6X11 这条路径。",
        learningGuide: [
          "先找到 TJ 接点和 1CLP1 跳闸出口压板。",
          "再沿 1D30 → TJ → 1CLP1 → 1D40 → 1n6X11 追踪正电源路径。",
          "最后判断压板退出时为什么保护动作也不能跳闸。"
        ]
      },
      {
        id: "psl641u-kk-switch",
        title: "操作开关（KK把手）",
        keywords: ["1KK", "KK", "1CLP3", "1D32", "1D39", "1D35", "1n6X10", "1n6X13", "KKJ"],
        region: { x: 0.07, y: 0.29, width: 0.25, height: 0.31 },
        componentType: "操作开关或控制开关（KK把手）",
        functionDescription:
          "通过 KK 操作开关实现断路器的就地合闸、就地分闸、遥控合闸和遥控分闸操作。",
        circuitRelation:
          "远方/就地切换决定就地分合闸回路或遥控回路是否接通；就地分闸时，正电源由 1D32 经相关触点进入 1D39 和 1n6X10；就地合闸时，正电源由 1D32 经相关触点进入 1D35 和 1n6X13。",
        actionLogic:
          "切至就地位置时，运维人员可通过 KK 把手进行就地分合闸，后台无法遥控；切至远方位置时，就地控制回路断开，遥控回路接通。",
        commonMistake:
          "1CLP3 遥控出口压板退出时，即使 KK 把手切至远方，遥控合闸和遥控分闸回路仍然断开，无法完成遥控操作。",
        safetyNotes: [
          "操作前应确认 1CLP3 遥控出口压板状态。",
          "就地分合闸应在保护测控屏上操作，切勿在断路器机构箱操作。"
        ],
        textbookHint:
          "老师注释把这里称为 KK 把手。读图时重点区分远方/就地切换、就地分合闸路径和遥控出口压板状态。",
        learningGuide: [
          "先找到 1KK 操作开关和 1CLP3 遥控出口压板。",
          "再分别追踪就地分闸和就地合闸的端子路径。",
          "最后说明远方/就地位置变化会怎样影响后台遥控。"
        ]
      },
      {
        id: "psl641u-position-lamp",
        title: "断路器位置指示灯",
        keywords: ["TWJ", "HWJ", "LD", "绿灯", "红灯", "1D48", "1D49"],
        region: { x: 0.62, y: 0.76, width: 0.32, height: 0.19 },
        componentType: "断路器位置指示灯",
        functionDescription: "显示断路器当前状态，即分闸位置或合闸位置。",
        circuitRelation:
          "断路器在分闸位置时，TWJ 继电器励磁，TWJ 接点闭合并点亮绿灯；断路器在合闸位置时，HWJ 继电器励磁，HWJ 接点闭合并点亮红灯。",
        actionLogic:
          "绿灯表示分闸，红灯表示合闸；同一时刻通常只能有一个位置指示灯亮。",
        commonMistake:
          "电力行业中红色代表危险、绿色代表安全，因此合闸带电对应红灯，分闸不带电对应绿灯。",
        safetyNotes: [
          "红灯和绿灯同时熄灭或同时点亮，通常表示位置指示回路存在缺陷。",
          "发现指示异常时，需要进一步排查回路。"
        ],
        textbookHint:
          "老师注释强调位置灯的颜色含义：合闸带电为红灯，分闸不带电为绿灯。",
        learningGuide: [
          "先找到 TWJ、HWJ 和红绿位置灯。",
          "再判断断路器分闸、合闸时哪个继电器励磁。",
          "最后说明为什么红灯代表合闸、绿灯代表分闸。"
        ]
      },
      {
        id: "psl641u-protection-close",
        title: "保护合闸回路",
        keywords: ["HJ", "1CLP2", "1D30", "1D34", "1D35", "1n6X13", "重合闸"],
        region: { x: 0.17, y: 0.33, width: 0.34, height: 0.19 },
        componentType: "保护合闸回路",
        functionDescription: "将重合闸合闸命令发送至断路器。",
        circuitRelation:
          "微机保护装置自动重合闸动作时，HJ 接点闭合；当 1CLP2 合闸出口压板投入时，正电源由 1D30 端子经 HJ 接点、1CLP2 压板，通过 1D34 或 1D35 端子进入 1n6X13 桩头，使断路器合闸回路接通。",
        actionLogic:
          "自动重合闸动作且合闸出口压板投入时，合闸回路导通，合闸命令送至断路器机构，使断路器合闸。",
        commonMistake:
          "1CLP2 合闸出口压板退出时，即使自动重合闸动作，合闸回路仍然断开；整组传动试验中断路器无法合闸时，应重点检查 1CLP2 是否投入。",
        safetyNotes: [
          "做保护逻辑检验时，应退出 1CLP2 合闸出口压板。",
          "避免检验过程中断路器频繁合闸，影响一次开关场检修安全。"
        ],
        textbookHint:
          "老师注释把这里归为保护合闸回路。读图时重点看 HJ 接点、1CLP2 合闸出口压板和 1D30、1D34/1D35、1n6X13 这条路径。",
        learningGuide: [
          "先找到 HJ 接点和 1CLP2 合闸出口压板。",
          "再沿 1D30 → HJ → 1CLP2 → 1D34/1D35 → 1n6X13 追踪正电源路径。",
          "最后判断压板退出时为什么重合闸动作也不能合闸。"
        ]
      }
    ]
  }
];

function overlapRatio(a: Selection, b: Selection) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  const overlapArea = width * height;
  const area = Math.max(0.0001, a.width * a.height);
  return overlapArea / area;
}

export function getDrawingCase(caseId?: string, fileName?: string) {
  if (caseId) {
    const byId = drawingCases.find((item) => item.id === caseId);
    if (byId) return byId;
  }

  const lowerFileName = fileName?.toLowerCase() ?? "";
  return drawingCases.find((item) =>
    lowerFileName.includes(item.id.toLowerCase()) ||
    lowerFileName.includes(item.shortTitle.toLowerCase()) ||
    lowerFileName.includes(item.fileName.toLowerCase())
  );
}

export function getCaseRegion(caseId?: string, fileName?: string, selection?: Selection) {
  const drawingCase = getDrawingCase(caseId, fileName);
  if (selection && drawingCase?.teacherAnnotations?.length) {
    const match = drawingCase.teacherAnnotations
      .map((annotation) => ({
        annotation,
        score: overlapRatio(selection, annotation.region)
      }))
      .sort((a, b) => b.score - a.score)[0];
    if (match && match.score >= 0.12) {
      return {
        ...drawingCase,
        knowledgeSource: "teacher" as const,
        title: match.annotation.title,
        keywords: match.annotation.keywords,
        componentType: match.annotation.componentType,
        functionDescription: match.annotation.functionDescription,
        circuitRelation: match.annotation.circuitRelation,
        actionLogic: match.annotation.actionLogic,
        safetyNotes: match.annotation.safetyNotes,
        textbookHint: match.annotation.textbookHint,
        learningGuide: match.annotation.learningGuide,
        teacherAnnotation: match.annotation
      };
    }
  }
  return getDrawingCase(caseId, fileName);
}
