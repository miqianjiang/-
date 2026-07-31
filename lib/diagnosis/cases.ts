export type DiagnosisOption = {
  id: string;
  label: string;
  feedback: string;
};

export type DiagnosisStep = {
  id: string;
  title: string;
  task: string;
  why: string;
  evidence: string;
  options: DiagnosisOption[];
  correctOptionId: string;
  commonMistake: string;
};

export type DiagnosisCase = {
  id: string;
  title: string;
  subtitle: string;
  scenario: string;
  goal: string;
  presetCause: string;
  safetyRules: string[];
  steps: DiagnosisStep[];
};

export const diagnosisCase: DiagnosisCase = {
  id: "zero-sequence-stage-iii-not-trip",
  title: "零序过流保护Ⅲ段保护未动作",
  subtitle: "1.05倍定值校验故障分析",
  scenario:
    "学生在进行线路保护装置零序过流保护Ⅲ段定值校验时，用微机保护测试仪加入1.05倍定值电流，装置未出现零序过流保护Ⅲ段动作。",
  goal:
    "按照老师给出的标准排查流程，判断故障原因，并形成一份完整的诊断记录。",
  presetCause: "零序过流保护Ⅲ段软压板未投入",
  safetyRules: [
    "试验前确认检修状态功能压板已投入，避免误发运行信息。",
    "试验时确认跳闸出口、合闸出口压板已退出，避免断路器误跳、误合。"
  ],
  steps: [
    {
      id: "setting",
      title: "核对保护定值",
      task: "先确认当前查看的是零序过流保护Ⅲ段，而不是零序Ⅰ段、Ⅱ段或其他过流保护。",
      why:
        "1.05倍校验必须建立在段别、动作电流和动作时间都读对的前提上，否则后面的测试电流和持续时间都会跟着错。",
      evidence:
        "定值单显示：零序过流保护Ⅲ段动作电流为2.00A，动作时间为1.50s。",
      options: [
        {
          id: "setting-ok",
          label: "段别与定值均正确，继续检查测试仪设置",
          feedback: "正确。定值核对无误后，下一步应检查测试仪输出是否满足动作条件。"
        },
        {
          id: "setting-wrong",
          label: "定值读错，应重新计算测试电流",
          feedback:
            "这一步不符合本案例证据。当前定值单已经明确为零序过流保护Ⅲ段，动作电流和时间均可用于后续校验。"
        },
        {
          id: "skip-to-plate",
          label: "直接检查压板，不需要看定值",
          feedback:
            "顺序太急了。压板确实可能是原因，但标准流程要求先排除段别和定值读取错误。"
        }
      ],
      correctOptionId: "setting-ok",
      commonMistake: "把零序过流保护Ⅲ段与零序Ⅰ段、Ⅱ段或过流Ⅲ段混淆。"
    },
    {
      id: "tester",
      title: "检查测试仪设置",
      task: "核对测试仪故障电流是否为1.05倍动作电流，故障持续时间是否不小于动作时间加0.1秒。",
      why:
        "过量保护虽然应在超过定值后可靠动作，但仍要满足动作时限；持续时间不足时，保护不会完成动作出口。",
      evidence:
        "测试仪设置：零序电流2.10A，故障持续时间1.70s。",
      options: [
        {
          id: "tester-ok",
          label: "电流和持续时间满足要求，继续查看装置采样",
          feedback:
            "正确。2.10A等于2.00A的1.05倍，1.70s也大于1.50s+0.10s。"
        },
        {
          id: "current-low",
          label: "电流幅值不足，应调高输出电流",
          feedback:
            "本案例中电流幅值已经达到1.05倍。若继续调高，可能掩盖真正问题。"
        },
        {
          id: "time-short",
          label: "持续时间不足，应延长到2秒以上",
          feedback:
            "当前持续时间已经满足动作时间加0.1秒的要求。应继续检查采样和投入状态。"
        }
      ],
      correctOptionId: "tester-ok",
      commonMistake: "只看电流倍数，忽略故障持续时间必须覆盖动作时限。"
    },
    {
      id: "sampling",
      title: "查看装置采样",
      task: "把测试时间临时设长，观察保护装置显示的零序电流采样值是否与测试仪输出一致。",
      why:
        "如果装置采不到零序电流，即使测试仪输出正确，保护逻辑也不会启动。",
      evidence:
        "装置采样显示：3I0=2.09A，数值与测试仪输出基本一致。",
      options: [
        {
          id: "sampling-ok",
          label: "采样正常，恢复测试时间后继续检查接线",
          feedback:
            "正确。装置已经采到零序电流，说明问题暂时不在采样量本身。"
        },
        {
          id: "sampling-bad",
          label: "采样异常，应优先检查IN端子接线",
          feedback:
            "本案例采样值与输出值基本一致，不能把故障直接归因到接线或采样回路。"
        },
        {
          id: "diagnose-now",
          label: "采样正常即可判断保护装置故障",
          feedback:
            "结论下得太早。采样正常后还要继续检查试验接线和保护投入条件。"
        }
      ],
      correctOptionId: "sampling-ok",
      commonMistake: "看到保护未动作就认为装置损坏，没有先用采样值验证输入量。"
    },
    {
      id: "wiring",
      title: "检查试验接线",
      task: "根据装置图纸核对零序电流是否接入专用外接零序电流端子，IN端子是否开路或接错。",
      why:
        "10kV、35kV线路保护常使用专用外接零序电流端子，接线错误会导致保护量无法正确进入装置。",
      evidence:
        "接线检查：测试线接入外接零序电流端子，端子紧固，回路无开路。",
      options: [
        {
          id: "wiring-ok",
          label: "接线正确，继续检查硬压板、软压板和控制字",
          feedback:
            "正确。定值、测试仪、采样和接线均正常后，下一步应检查保护投入条件。"
        },
        {
          id: "wiring-bad",
          label: "接线错误，应重新接入IN端子",
          feedback:
            "本案例证据显示接线正确，且装置采样值正常；不能把原因定为接线错误。"
        },
        {
          id: "skip-enable",
          label: "接线正常即可重新试验",
          feedback:
            "还差一步。保护是否投入会直接决定它能不能动作，必须检查。"
        }
      ],
      correctOptionId: "wiring-ok",
      commonMistake: "没有结合装置图纸核对专用零序端子，或把采样正常的情况仍误判为接线错误。"
    },
    {
      id: "enable",
      title: "检查保护投入状态",
      task: "检查零序保护功能硬压板、软压板、零序Ⅲ段软压板和相关控制字是否投入。",
      why:
        "保护逻辑需要定值、采样、接线和投入条件同时满足。任一投入条件缺失，保护都可能不动作。",
      evidence:
        "检查结果：硬压板已投入，控制字已投入；零序过流保护Ⅲ段软压板处于退出状态。",
      options: [
        {
          id: "soft-plate-off",
          label: "故障原因为零序过流保护Ⅲ段软压板未投入",
          feedback:
            "正确。这就是本案例预设故障原因。投入该软压板后，再按原条件复测，保护应可靠动作。"
        },
        {
          id: "hard-plate-off",
          label: "故障原因为功能硬压板未投入",
          feedback:
            "证据不支持。当前功能硬压板已投入，真正缺失的是零序Ⅲ段软压板。"
        },
        {
          id: "control-word-off",
          label: "故障原因为控制字未投入",
          feedback:
            "证据不支持。当前控制字已投入，真正缺失的是零序Ⅲ段软压板。"
        }
      ],
      correctOptionId: "soft-plate-off",
      commonMistake: "只检查总功能投入，没有继续核对具体保护段的软压板状态。"
    }
  ]
};
