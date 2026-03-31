# Most Valuable 5 Files To Split

这份清单只挑“最值得拆”的文件，不是单纯按行数排名。

判断标准：

1. 文件足够大，容易被 AI 反复读到。
2. 同时承担了多个职责，增加理解成本。
3. 属于高频业务链路，日常修改概率高。
4. 拆分后不仅更好维护，也能减少单次上下文体积。

## 1. `/Users/yun/lindong/miniprogram/utils/course.js`

- 行数：约 1125 行
- 优先级：最高

### 为什么最值得拆

这个文件已经明显不是单一的 “course util”：

- 既有 mock 数据
- 又有课程详情组装逻辑
- 又有富文本节点构造
- 又有拼团规则文案
- 又有接口请求封装
- 还可能混合价格、时间、距离等展示转换

这会带来两个问题：

- 小程序课程链路相关问题几乎都会把它读进来
- AI 每次都要在一大堆静态数据、展示文案和业务逻辑之间来回切换

### 建议拆法

优先拆成：

- `miniprogram/utils/courseApi.js`
- `miniprogram/utils/courseFormatters.js`
- `miniprogram/utils/courseRichText.js`
- `miniprogram/mock/courseMockData.js`

### 预期收益

- 课程详情页、支付页、首页不再共享一个超大入口文件
- mock 数据不再污染生产逻辑上下文
- AI 在排查课程相关问题时能更快定位真正相关模块

## 2. `/Users/yun/lindong/console/src/pages/CourseFormPage.tsx`

- 行数：约 734 行
- 优先级：最高

### 为什么值得拆

这个页面同时承担了：

- 新建/编辑/查看三种模式
- 课程详情拉取
- 拼团记录拉取
- 表单状态管理
- 区域联动
- 图片上传
- 地理解析
- 提交和下架动作

这是典型的“页面组件承担全部职责”的文件。它不只是长，而且每次改课程后台时都非常容易被读到。

### 建议拆法

优先拆成：

- `console/src/pages/course-form/CourseFormPage.tsx`
- `console/src/pages/course-form/useCourseForm.ts`
- `console/src/pages/course-form/CourseBasicFields.tsx`
- `console/src/pages/course-form/CourseCoachFields.tsx`
- `console/src/pages/course-form/CourseGroupPanel.tsx`
- `console/src/pages/course-form/courseFormHelpers.ts`

### 预期收益

- 改表单字段时不必读完整页
- 改拼团记录展示时不必把上传、地理编码逻辑一起读进来
- 更适合 AI 定点修改

## 3. `/Users/yun/lindong/backend/shared/services/groupOrders.js`

- 行数：约 602 行
- 优先级：高

### 为什么值得拆

这个文件从已读片段看，至少包含：

- pending 订单清理
- 过期拼团清理
- 用户是否参加过拼团校验
- 拼团状态判断
- 订单创建
- 支付/退款相关规则衔接

也就是说，它同时覆盖：

- 查询
- 校验
- 状态迁移
- 副作用处理
- 规则组合

这类文件的坏处是，AI 要改一个小逻辑时，往往必须连同整个拼团订单生命周期一起读。

### 建议拆法

优先拆成：

- `backend/shared/services/groupOrderQueries.js`
- `backend/shared/services/groupOrderValidations.js`
- `backend/shared/services/groupOrderTransitions.js`
- `backend/shared/services/groupOrderCleanup.js`
- `backend/shared/services/groupOrderCommands.js`

### 预期收益

- 支付、退款、补偿、过期清理可以分开分析
- 后端拼团问题不再总是把整个订单生命周期塞进上下文

## 4. `/Users/yun/lindong/backend/console-api/services/coursesService.js`

- 行数：约 532 行
- 优先级：高

### 为什么值得拆

这个文件目前至少混了：

- 列表/详情映射
- payload 校验
- payload 到数据库字段转换
- 地理编码
- 分页和筛选
- 生命周期和状态判断
- 管理日志

对 AI 来说，这类 service 的问题在于：改列表接口、改表单校验、改地理编码，都会把同一大文件读一遍。

### 建议拆法

优先拆成：

- `backend/console-api/services/courseMappers.js`
- `backend/console-api/services/courseValidators.js`
- `backend/console-api/services/courseGeocode.js`
- `backend/console-api/services/courseQueries.js`
- `backend/console-api/services/courseCommands.js`

### 预期收益

- 控制台课程模块的读写职责会更清晰
- AI 改一个点时不用重复加载全部规则

## 5. `/Users/yun/lindong/miniprogram/pages/course/detail/index.js`

- 行数：约 680 行
- 优先级：高

### 为什么值得拆

这个页面已经混合了：

- 页面生命周期
- 分享逻辑
- 拼团倒计时
- 拼团状态展示
- 课程详情归一化
- activeGroup 视图模型转换
- 登录弹窗状态
- 下单动作

也就是说，它同时处理：

- 页面状态
- 展示格式
- 用户动作
- 业务流程

这类文件很容易成为小程序高频读取入口，因为课程详情页通常是核心链路。

### 建议拆法

优先拆成：

- `miniprogram/pages/course/detail/index.js`
- `miniprogram/pages/course/detail/view-model.js`
- `miniprogram/pages/course/detail/group-meta.js`
- `miniprogram/pages/course/detail/timer.js`
- `miniprogram/pages/course/detail/actions.js`

### 预期收益

- 倒计时和状态展示规则不再和页面生命周期强耦合
- 分享、登录、下单问题可以各自定点处理

## 暂时排在候补位的文件

这些文件也偏大，但优先级略低于前 5：

- `/Users/yun/lindong/backend/console-api/services/groupsService.js`
- `/Users/yun/lindong/backend/utils/adminStore.js`
- `/Users/yun/lindong/console/src/pages/AccountListPage.tsx`
- `/Users/yun/lindong/console/src/pages/OrderListPage.tsx`
- `/Users/yun/lindong/miniprogram/pages/home/index.js`

原因不是它们不值得拆，而是前 5 个文件更像“关键链路 + 多职责混合 + 高频上下文入口”的叠加点。

## 推荐拆分顺序

建议按这个顺序动手：

1. `miniprogram/utils/course.js`
2. `console/src/pages/CourseFormPage.tsx`
3. `backend/shared/services/groupOrders.js`
4. `backend/console-api/services/coursesService.js`
5. `miniprogram/pages/course/detail/index.js`

## 执行策略

为了避免大改带来回归风险，建议每次只拆一个文件，并遵守三个原则：

1. 先抽纯函数和映射逻辑，再抽副作用逻辑。
2. 先保持对外接口不变，再逐步整理调用方。
3. 每次拆分都补一份短入口说明，方便后续 AI 和人一起维护。

## 下一步

如果继续推进，最合适的下一步不是同时拆 5 个，而是先从这两个里选一个落地：

- `/Users/yun/lindong/miniprogram/utils/course.js`
- `/Users/yun/lindong/console/src/pages/CourseFormPage.tsx`

这两个文件拆完之后，AI 上下文和人工维护体验都会立刻改善。
