# Boss 投递助手开发文档

## 1. 产品范围

本项目是独立 Chrome Manifest V3 扩展，目标是减少多平台求职中的重复操作。当前代码已经接入 11 个真实平台和 1 个 localhost 演示适配器；真实平台的选择器仍需在用户登录态下逐站验收。

首期支持以下 11 个平台：

| 批次 | 平台 | 网址 | 当前策略 |
| --- | --- | --- | --- |
| P0 | Boss 直聘 | zhipin.com | 优先稳定 |
| P0 | 智联招聘 | zhaopin.com | 优先稳定 |
| P0 | 前程无忧 | 51job.com | 优先稳定 |
| P0 | 猎聘 | liepin.com | 优先稳定 |
| P0 | 实习僧 | shixiseng.com | 优先稳定 |
| P0 | 牛客 | nowcoder.com | 优先稳定 |
| P1 | 应届生求职网 | yingjiesheng.com | 校招补充 |
| P1 | 国聘 | iguopin.com | 校招补充 |
| P1 | 拉勾招聘 | lagou.com | 技术岗位补充 |
| P2 | 58 同城招聘 | 58.com | 页面差异较大 |
| P2 | 脉脉 | maimai.cn | 页面差异较大 |
| 后续 | LinkedIn | linkedin.com | 暂缓 |

`localhost` 仅用于本地演示，不属于真实平台范围。

## 2. 功能边界

扩展可以读取岗位公开文本、计算本地匹配分、加入候选队列、生成招呼语模板、复制招呼语和记录状态。

扩展不会自动点击“立即沟通”、不会发送消息、不会上传简历、不会处理验证码，也不会绕过反爬或账号风控。最终投递动作由用户在目标网站中人工确认。

## 3. 技术栈

- TypeScript：共享类型、评分规则、平台适配逻辑。
- Chrome Manifest V3：扩展权限、Content Script、Service Worker、Popup。
- esbuild：将三个入口构建为浏览器可加载脚本。
- 原生 DOM API：页面读取、节点标记和按钮注入，不引入 Playwright/Puppeteer 运行时。
- `chrome.storage.local`：本地保存设置、候选队列和统计。

## 4. 目录职责

```text
src/background/   后台存储、消息协议和队列状态
src/content/      各平台页面读取和投递准备控件
src/popup/        设置编辑、队列查看、招呼语复制
src/shared/       岗位类型、筛选设置、评分和模板渲染
public/           manifest、样式和静态弹窗文件
demo/             不连接真实平台的本地验收页面
docs/             开发记录和问题解决记录
```

## 5. 平台适配原则

每个平台提供独立的 `host + cardSelectors + fieldSelectors` 配置。通用层只处理评分、黑名单、去重、队列和本地记录；平台层只处理岗位卡片识别和页面填充。

当前适配器配置位于 `src/content/adapters/`，每个平台一个文件，由 `index.ts` 统一注册并通过 `getPlatformAdapter(location.hostname)` 选择当前站点。选择器采用稳定 class、`data-*` 属性和语义兜底的组合；平台改版时只调整对应适配器和 fixture。

平台适配必须满足：

1. 读取失败时不修改原页面业务节点。
2. 找不到稳定字段时显示“待确认”，不猜测薪资、地点或公司信息。
3. 所有写入页面的动作都必须是用户点击触发的准备动作。
4. 不保存 Cookie、密码、验证码或完整浏览历史。

## 6. 开发与验收

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm test
```

将 `dist/` 通过 Chrome 的“加载已解压的扩展程序”安装。真实平台验收只验证岗位读取、筛选、加入队列、复制招呼语和记录去重；不执行最终发送。
