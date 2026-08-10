# 功能3：保护逻辑动态推演

## 功能定位

功能3当前名称为：

> 保护逻辑动态推演

页面入口保持为 `/diagnosis`。

本功能将静态零序过流保护Ⅲ段动作逻辑图转化为可交互的动态逻辑模型。学生通过改变压板、控制字、回路状态、测试条件及保护定值，实时观察保护投入、启动、延时、动作和复归过程。

核心体验：

```text
改变保护条件
→ 逻辑节点 0/1 实时变化
→ 逻辑线路状态实时变化
→ 零序Ⅲ段投入
→ 零序Ⅲ段启动
→ 最终动作允许
→ t0.set 延时
→ 零序Ⅲ段动作 / 不动作
→ 自动说明当前不动作原因
```

当前页面只保留动态推演主流程。保护逻辑计算、节点 `0/1` 和动作结果全部由确定性程序完成。

## 页面入口

- 首页功能3卡片：`/`
- 功能3页面：`/diagnosis`
- 页面文件：`app/diagnosis/page.tsx`
- 主组件：`components/diagnosis/DiagnosisTrainer.tsx`

## 页面结构

顶部：

- 页面标题：保护逻辑动态推演
- 当前状态：待推演 / 推演中 / 延时中 / 已动作 / 未动作
- 复位按钮
- 返回入口

左侧：

- 典型场景
  - 正常动作
  - 软压板退出
  - 电流不足
  - 持续时间不足
- 保护投入条件
  - 硬压板
  - 软压板
  - Ⅲ段控制字
- 保护启动条件
  - 电流回路接线正确
  - 测试仪故障量设置正确
  - 实际 `3I0`
  - 动作电流定值 `I0.set`
- 延时条件
  - 动作时间定值 `t0.set`
  - 故障量持续时间
- 开始推演
- 停止推演
- 复位

中间：

- 当前选中案例的动态逻辑图或待接入流程区
- 已接入案例显示所有节点 `0/1`
- 已接入案例显示线路高亮
- 点击开始推演后的分步状态传播
- 延时动态计时
- 待接入案例显示该案例自己的独立占位流程，不复用其他案例图纸

右侧：

- 逻辑案例选择
- 当前保护状态
- 节点状态汇总
- 当前未满足条件
- 逻辑解释
- 选中节点解释
- 操作记录

## 核心状态字段

类型定义位于：

`lib/protection-logic/types.ts`

当前核心输入：

- `zeroSequenceHardPlate`：零序电流保护硬压板投入
- `zeroSequenceSoftPlate`：零序电流保护软压板投入
- `stageThreeControlWord`：零序过流保护Ⅲ段控制字投入
- `currentCircuitState`：电流回路底层状态，`normal | open | wrongTerminal`
- `testerFaultSettingCorrect`：测试仪故障量设置正确
- `testerCurrent`：实际 `3I0`，单位 A
- `currentSetting`：动作电流定值 `I0.set`，单位 A
- `delaySetting`：动作时间定值 `t0.set`，单位 s
- `testerDuration`：故障量持续时间，单位 s
- `testerOutputRunning`：动态推演是否正在运行，由系统控制

底层仍保留安全相关字段，但当前页面不使用它们作为核心流程：

- `maintenancePlate`
- `tripOutletPlate`
- `closeOutletPlate`

## 默认状态

默认推演状态：

- 硬压板 = `1`
- 软压板 = `1`
- Ⅲ段控制字 = `1`
- 电流回路接线正确 = `1`
- 测试仪故障量设置正确 = `1`
- `3I0 = 1.50A`
- `I0.set = 1.00A`
- `t0.set = 1.50s`
- 故障量持续时间 = `2.00s`

进入页面初始状态：

- 零序Ⅲ段投入 = `1`
- 电流比较判据 = `1`
- 零序Ⅲ段启动 = `1`
- 最终动作允许 = `1`
- 零序Ⅲ段动作 = `0`

点击“开始推演”后才进入动态延时过程，达到 `t0.set` 后动作节点变为 `1`。

## 典型场景

左侧提供 4 个一键载入场景，便于课堂快速演示：

- 正常动作：全部条件满足，观察启动、延时和动作
- 软压板退出：投入支路中断，启动满足但最终不动作
- 电流不足：`3I0` 未大于 `I0.set`，启动支路不成立
- 持续时间不足：保护已启动，但故障量持续时间小于动作时间定值，延时复归

## 逻辑案例选择

右侧顶部提供“逻辑案例”选择区，作为后续扩展为保护逻辑模型库的入口。

当前已接入案例：

- 零序过流保护Ⅲ段动作逻辑

当前预留占位案例：

- 距离保护Ⅰ段动作逻辑
- 重合闸逻辑
- 过流保护Ⅱ段动作逻辑

点击已接入案例时，会载入该案例的默认状态、典型场景和说明。

点击待接入案例时，会切换到该案例自己的独立流程区，并提示该案例流程图、节点和计算规则待接入。页面不会继续展示零序过流保护Ⅲ段动态图，避免学生误以为多个案例共用同一套逻辑。

默认状态配置位于：

`lib/protection-logic/cases.ts`

## 逻辑计算规则

纯函数逻辑引擎位于：

`lib/protection-logic/engine.ts`

### 1. 零序Ⅲ段投入

```text
stageEnabled =
zeroSequenceHardPlate
AND zeroSequenceSoftPlate
AND stageThreeControlWord
```

### 2. 电流回路接线正确

```text
currentCircuitCorrect = currentCircuitState === "normal"
```

即：

- `normal` → `1`
- `open` → `0`
- `wrongTerminal` → `0`

### 3. 电流比较判据

```text
currentCriterion = actual3I0 > currentSetting
```

必须严格大于。如果 `3I0 = I0.set`，电流比较节点为 `0`。

### 4. 零序Ⅲ段启动

```text
stageStarted =
currentCircuitCorrect
AND testerFaultSettingCorrect
AND currentCriterion
```

注意：

`testerOutputRunning` 只表示页面动态推演是否正在运行，不是老师原图中的保护判据。

### 5. 最终动作允许

```text
actionPermitted =
stageEnabled
AND stageStarted
```

### 6. 延时与动作

当 `actionPermitted = 1` 且点击“开始推演”后，开始累计 `t0.set` 延时。

推演运行时，动态逻辑图会按以下顺序逐段展示状态传播：

```text
保护投入支路
→ 保护启动支路
→ 最终动作允许
→ t0.set 延时
→ 零序Ⅲ段动作 / 复归
```

当：

```text
elapsedTime >= delaySetting
```

则：

```text
stageAction = 1
```

如果延时过程中任一上游条件变为 `0`：

- 延时停止
- `elapsedTime` 清零
- `stageAction = 0`
- 操作记录写入“延时复归”

当故障量持续时间到达 `testerDuration`：

- 推演停止
- 若 `testerDuration < delaySetting`，逻辑解释显示故障量持续时间不足

## 统一逻辑状态对象

`calculateProtectionLogic` 返回统一的 `LogicSnapshot`。

核心字段：

- `stageEnabled`
- `currentCircuitCorrect`
- `testerFaultSettingCorrect`
- `currentCriterion`
- `stageStarted`
- `actionPermitted`
- `elapsedTime`
- `stageAction`

同时提供 `nodes` 对象，每个节点包含：

- `value`
- `label`
- `upstream`
- `reason`
- `unmetConditions`

页面中的动态逻辑图、状态汇总、节点说明和逻辑解释都读取这套确定性结果。

## 新案例接入流程

后续老师提供新静态逻辑图时，按以下固定流程接入：

1. 整理老师提供的逻辑图
   - 输入条件
   - 中间节点
   - AND / OR / 比较 / 延时关系
   - 动作节点
   - 默认参数
   - 典型不动作原因

2. 新增案例配置
   - 在 `lib/protection-logic/cases.ts` 中新增 `ProtectionCase`
   - 配置 `id`、`title`、`description`、`logicType`、`defaultState`、`presets`

3. 新增确定性逻辑计算函数
   - 例如 `calculateDistanceStageOneLogic(state, elapsed)`
   - 保护动作结果仍由程序逻辑计算，不交给 AI

4. 新增对应动态逻辑图组件
   - 不同保护逻辑图结构不同，不强行复用零序Ⅲ段 SVG
   - 选择该案例时，中间画布必须显示该案例自己的流程图
   - 未接入完整逻辑前，保持该案例独立占位，不回退到其他案例

5. 在案例选择区注册
   - 将案例状态从 `reserved` 调整为 `available`
   - 接入默认参数、典型场景和逻辑图
   - 左侧控制区只显示该案例自己的参数和场景
   - 右侧状态分析只解释该案例自己的节点结果

6. 补充验收场景
   - 正常动作
   - 投入条件不满足
   - 启动条件不满足
   - 定值比较不满足
   - 延时复归

## 逻辑解释

右侧说明名称为“逻辑解释”。

逻辑解释由 `engine.ts` 中的 `buildLogicExplanation(snapshot, state)` 生成，不调用 AI，不决定动作结果，只解释确定性逻辑结果。

页面同时保留“节点说明”：点击任一 SVG 节点后，右侧显示该节点的当前值、计算依据、上游输入和未满足条件。

典型说明：

- 软压板退出：说明软压板为 `0` 导致零序Ⅲ段投入为 `0`
- 控制字退出：说明控制字为 `0` 导致投入支路不满足
- 电流不足：说明 `3I0` 未大于 `I0.set`
- 两者相等：说明判据要求严格大于
- 持续时间不足：说明保护已启动但未完成延时便复归

## 操作记录

操作记录用于课堂回看。

当前记录：

- 修改硬压板
- 修改软压板
- 修改控制字
- 修改电流回路
- 修改测试仪故障量设置
- 修改 `3I0`
- 修改 `I0.set`
- 修改 `t0.set`
- 开始推演
- 停止推演
- 保护启动
- 延时开始
- 延时复归
- 保护动作
- 复位

操作记录仅服务于课堂回看，不参与成绩或任务评价。

## 验收场景

当前逻辑引擎需验证以下 9 个场景：

| 场景 | 条件 | 预期 |
| --- | --- | --- |
| 1 | 全部条件满足，`3I0 > I0.set`，点击开始推演 | 投入=1，启动=1，最终动作允许=1，完成延时后动作=1 |
| 2 | 软压板=0，其他条件满足 | 投入=0，启动=1，最终动作允许=0，不动作，并说明软压板原因 |
| 3 | 控制字=0 | 投入=0，不动作，并说明控制字原因 |
| 4 | 电流回路接线正确=0 | 启动=0，不动作，并说明启动支路原因 |
| 5 | 测试仪故障量设置正确=0 | 启动=0，不动作，并说明测试仪故障量设置原因 |
| 6 | `3I0=0.8A`，`I0.set=1.0A` | 电流判据=0，启动=0，不动作，并说明电流不足 |
| 7 | `3I0=I0.set` | 电流判据=0，并明确说明“严格大于” |
| 8 | 延时过程中将软压板由1改为0 | `actionPermitted` 立即变为0，延时停止，计时清零，不动作 |
| 9 | `testerDuration < delaySetting` | 保护启动但未完成延时，故障量持续时间结束后复归，不动作，并说明持续时间不足 |

## 本地运行与检查

```bash
npm install
npm run dev
```

浏览器访问：

```text
http://localhost:3000/diagnosis
```

代码检查：

```bash
npm run check
```

生产构建：

```bash
npm run build
```

## 文件边界

功能3相关文件：

- `app/diagnosis/page.tsx`
- `components/diagnosis/DiagnosisTrainer.tsx`
- `lib/protection-logic/types.ts`
- `lib/protection-logic/cases.ts`
- `lib/protection-logic/safety.ts`
- `lib/protection-logic/engine.ts`
- `app/globals.css` 中 `.logic-*`、`.svg-node`、`.review-*` 等样式段

功能1、功能2和首页公共入口不依赖功能3逻辑引擎。
