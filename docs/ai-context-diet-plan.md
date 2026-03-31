# AI Context Diet Plan

## 目标

这份方案的目标不是减少仓库磁盘占用，而是减少 AI 助手在每轮任务里读入的上下文体积，降低 `input tokens` 和 `cached input` 的消耗，并提升命中率与响应稳定性。

对这个仓库来说，最重要的原则是：

1. 不让无关目录进入上下文。
2. 让每次任务只围绕一个子项目展开。
3. 让高频被读文件更短、更稳定、更容易定位。

## 仓库现状

当前根目录下有多个并列子项目：

- `/Users/yun/lindong/backend`
- `/Users/yun/lindong/frontend`
- `/Users/yun/lindong/console`
- `/Users/yun/lindong/miniprogram`
- `/Users/yun/lindong/qa`
- `/Users/yun/lindong/docs`

其中最容易造成 AI 上下文膨胀的内容不是业务源码本身，而是这些目录：

- `/Users/yun/lindong/console/dist`
- `/Users/yun/lindong/docs`
- `/Users/yun/lindong/qa/regression/playwright-report`
- `/Users/yun/lindong/qa/regression/test-results`
- `*/node_modules`

这些目录要么是构建产物，要么是测试输出，要么是长文档资料，token 密度高，但通常对当前编码任务帮助有限。

## 第一层：立即执行的瘦身动作

这些动作收益最高，且几乎不需要改业务代码。

### 1. 固定排除目录

AI 协作时，默认不要读取下列路径：

- `/Users/yun/lindong/docs`
- `/Users/yun/lindong/console/dist`
- `/Users/yun/lindong/qa/regression/playwright-report`
- `/Users/yun/lindong/qa/regression/test-results`
- `/Users/yun/lindong/backend/node_modules`
- `/Users/yun/lindong/frontend/node_modules`
- `/Users/yun/lindong/console/node_modules`
- `/Users/yun/lindong/qa/regression/node_modules`

建议把这些路径同步写入你使用的 AI 工具忽略配置，例如 `.codexignore`、`.cursorignore` 或等价配置。

推荐忽略模式：

```gitignore
**/node_modules/
**/dist/
**/build/
**/.next/
**/coverage/
**/playwright-report/
**/test-results/
.DS_Store
docs/
```

说明：

- `docs/` 在这个仓库里更适合按需点读，而不是默认纳入工程上下文。
- `dist/` 和测试报告不应该进入常规编码问答。

### 2. 按子项目开工作会话

不要在仓库根目录处理所有问题。默认按任务类型切换工作目录：

- 后端问题：`/Users/yun/lindong/backend`
- 前端 H5 问题：`/Users/yun/lindong/frontend`
- 管理台问题：`/Users/yun/lindong/console`
- 小程序问题：`/Users/yun/lindong/miniprogram`
- 回归测试问题：`/Users/yun/lindong/qa/regression`

这样做的核心收益：

- 模型更少扫描无关目录
- 文件搜索结果更聚焦
- 更容易复用稳定前缀，提升缓存命中质量

### 3. 问题描述改成“定点读取”

避免这类高消耗请求：

- “帮我看一下整个项目”
- “分析一下这个仓库”
- “把这个功能改好”

改成这类低消耗请求：

- “只看这两个 controller 和一个 service，定位订单创建逻辑”
- “只检查 console 的课程管理页面”
- “只分析回归失败用例和相关接口”

建议每次任务都明确三件事：

1. 子项目范围
2. 目标链路
3. 允许读取的文件数或目录范围

### 4. 日志和报错只传增量

不要每轮重复贴完整日志、长 SQL、完整接口返回或整页 DOM。

建议规则：

- 第一次发完整关键片段
- 第二次开始只发新增报错和变化点
- 结果稳定后改成“沿用上一轮上下文，只补充这 20 行”

## 第二层：按仓库结构优化上下文暴露面

### 后端：`/Users/yun/lindong/backend`

这个目录体量最大，最容易在“帮我找链路”时被过度读取。建议：

- 把入口说明收敛到一份短文档，标清 `routes`、`console-api`、`shared` 的职责。
- 高频链路优先维护“索引型文档”，不要每次靠 AI 重新全局搜索。
- 对特别长的 controller/service 文件做拆分，按业务域切开，而不是继续堆逻辑。

适合建立短索引的位置：

- `/Users/yun/lindong/backend/routes`
- `/Users/yun/lindong/backend/console-api`
- `/Users/yun/lindong/backend/shared`

建议每个业务域保留一份很短的“入口地图”，例如：

- 哪个路由进来
- 哪个 service 处理
- 哪个表或共享模块参与

### 前端：`/Users/yun/lindong/frontend`

前端源码文件数不算夸张，但如果每次都让 AI 从页面、组件、样式、路由一起摸，会持续放大输入。

建议：

- 保留清晰的页面入口和路由映射。
- 把公用 hooks、api、schema 放在固定位置。
- 页面文件超过一个舒适阈值后拆成容器组件和子组件。

优先让 AI 读取的应是：

- 页面入口
- 路由定义
- 相关 API 封装
- 相关状态或 hooks

不建议默认一并读取整个页面目录。

### 管理台：`/Users/yun/lindong/console`

这里最需要避免的是把构建产物 `dist` 读进来。除此之外，建议把问题固定在 `src` 范围内。

优先读取：

- `/Users/yun/lindong/console/src`

默认排除：

- `/Users/yun/lindong/console/dist`

如果后续发现某些页面文件过长，优先拆页面逻辑，而不是先做样式层优化。对 token 来说，超长混合文件比多个边界清晰的小文件更贵。

### 小程序：`/Users/yun/lindong/miniprogram`

小程序目录天然容易让 AI 一次性扫多个页面。建议：

- 页面问题只看目标 `pages/*`
- 复用逻辑收敛到 `components` 和 `utils`
- 文档说明不要和源码放在同一轮上下文里

适合长期维护一份简短地图：

- 页面路径
- 关键组件
- 请求入口
- 依赖的云函数或后端接口

### QA：`/Users/yun/lindong/qa/regression`

这里最需要处理的是测试产物膨胀。

默认只让 AI 看：

- `/Users/yun/lindong/qa/regression/tests`
- 必要的配置文件

默认不要让 AI 看：

- `/Users/yun/lindong/qa/regression/playwright-report`
- `/Users/yun/lindong/qa/regression/test-results`

如果需要排查回归问题，优先给：

- 失败用例名
- 失败断言
- 精简后的 trace/截图结论

而不是整份 HTML 报告。

## 第三层：值得做的代码级瘦身

代码去冗余有用，但只应优先处理“高频被 AI 读取”的文件。

### 优先处理的文件特征

- 单文件承载多个职责
- 超长常量表或映射表
- 重复 schema、重复类型、重复请求封装
- 同一业务规则在多个子项目里各写一份
- 组件文件同时混合页面逻辑、数据请求、表单规则、样式判断

### 具体做法

1. 抽公共类型和 schema

把重复的接口结构、表单 schema、状态枚举收敛到公共位置。收益不只是减少代码行数，更重要的是减少 AI 每轮解释同一概念时需要重复阅读的内容。

2. 拆长文件

如果某个页面或 service 已经变成“一个文件读懂半个业务”，优先拆分。拆分标准不是机械按行数，而是按职责边界：

- 路由层
- 参数校验层
- 业务编排层
- 数据访问层

3. 把长说明改成短索引

文档也会烧 token。对于 `docs` 里的 PRD、计划、交接文档，建议保留完整版，但另外维护一版 20 到 40 行的“AI 快速入口摘要”。

摘要里只保留：

- 目标
- 范围
- 关键表/接口
- 当前实现位置
- 已知限制

## 团队协作约定

建议把下面这套规则作为默认协作方式：

1. 一个会话只处理一个子项目。
2. 一个问题只打开一条业务链路。
3. 优先指定文件，不让 AI 自由扫全仓。
4. 测试报告和构建产物默认不进上下文。
5. 文档默认按需读取，不默认整目录读取。
6. 大日志只发关键片段和增量。

## 实施优先级

### 本周就做

1. 给 AI 工具补忽略规则，屏蔽 `docs`、`dist`、`playwright-report`、`test-results`、`node_modules`。
2. 把日常会话切到子项目目录，不再从仓库根目录处理所有问题。
3. 统一提问模板，要求指定范围和链路。

### 下一步做

1. 给 `backend`、`frontend`、`console`、`miniprogram` 各补一份短入口地图。
2. 清点高频超长文件，按业务边界拆分。
3. 把超长 PRD/交接文档补一版 AI 摘要版。

### 最后再做

1. 合并跨目录重复 schema 和类型。
2. 统一高频接口封装与错误处理描述。
3. 为常见任务沉淀固定提示模板，减少每轮重复说明。

## 预期收益

如果先完成第一层动作，通常就能拿到最明显的收益：

- 单轮读取文件数下降
- 搜索结果噪音下降
- cached input 规模下降
- 模型更容易命中稳定前缀
- 响应速度更稳定

如果再叠加第二层和第三层动作，收益会更多体现在：

- AI 改代码更准
- 少走错目录
- 少重复解释相同业务概念
- 少把文档和测试产物当成源码上下文

## 建议的下一步

如果要继续落地，建议按这个顺序执行：

1. 新增 AI 忽略文件。
2. 为每个子项目补一页“入口地图”。
3. 我再帮你挑出最值得拆分的 5 个高频文件。
