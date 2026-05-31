# Miniprogram Rules

- 小程序使用原生 `WXML + WXSS + JavaScript`，根工程配置在 `project.config.json`，入口在 `miniprogram/app.json`。
- UI 优先使用 `weui-miniprogram` 官方组件和官方样式语义；能用 WeUI 时不要在页面里重复造基础组件。
- 组件优先局部注册，保持 `lazyCodeLoading` 的收益；全局组件只在确有必要时引入。
- 主题色、状态色、阴影、渐变优先走主题 token 或统一配置，避免在页面中散写品牌色。
- 页面 UI 改动需参考 `docs/ui-agent.md`：遵循微信设计原则、8rpx 间距体系、44px 可点击区域、清晰导航和一致文案。
- 小程序请求封装在 `miniprogram/utils/request.js`，业务数据和 mock 兜底多在 `miniprogram/utils/` 下；真实后端明确返回错误时不要静默吞掉问题。

关联文档：

- `docs/miniprogram/tech.md`
- `docs/ui-agent.md`
