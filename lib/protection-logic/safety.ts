import type { ExperimentState, SafetyRule, SafetyViolation } from "./types";

export const safetyRules: SafetyRule[] = [
  {
    ruleId: "maintenance-plate-required",
    when: (state: ExperimentState) => !state.maintenancePlate,
    violationName: "检修状态功能压板未投入",
    riskConsequence: "继续试验可能造成装置异常信息上传或干扰运行监视。",
    prompt: "检修状态功能压板未投入。继续试验可能造成装置异常信息上传或干扰运行监视。",
    handling: "block",
    basis: "请按照继电保护检验相关规程执行"
  },
  {
    ruleId: "trip-outlet-plate-open",
    when: (state: ExperimentState) => state.tripOutletPlate,
    violationName: "跳闸出口压板未退出",
    riskConsequence: "试验过程中可能造成断路器误跳闸。",
    prompt: "跳闸出口压板未退出。试验过程中可能造成断路器误跳闸。",
    handling: "block",
    basis: "请按照继电保护检验相关规程执行"
  },
  {
    ruleId: "close-outlet-plate-open",
    when: (state: ExperimentState) => state.closeOutletPlate,
    violationName: "合闸出口压板未退出",
    riskConsequence: "试验过程中可能造成非预期合闸或重合闸。",
    prompt: "合闸出口压板未退出。试验过程中可能造成非预期合闸或重合闸。",
    handling: "block",
    basis: "请按照继电保护检验相关规程执行"
  }
];

export function checkSafetyRules(state: ExperimentState): SafetyViolation[] {
  return safetyRules.filter((rule) => rule.when(state)).map(({ when: _when, ...rule }) => rule);
}
