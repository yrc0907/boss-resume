# Boss 投递助手

独立 Chrome Manifest V3 扩展，用于 Boss 直聘岗位的本地筛选、匹配评分、投递准备和记录。

## 边界

- 只读取岗位公开文本并在本地计算匹配分。
- 只提供“加入投递准备”和复制招呼语，不自动点击“立即沟通”、不发送消息、不上传简历。
- 不绕过验证码、反爬或账号风控。
- 默认使用 `chrome.storage.local` 保存设置和队列，不配置第三方服务。

## 开发环境

- Node.js 20+
- pnpm 9+

```bash
pnpm install
pnpm build
```

构建产物位于 `dist/`。在 Chrome 打开 `chrome://extensions`，开启“开发者模式”，选择“加载已解压的扩展程序”，选中本目录下的 `dist` 文件夹即可。使用扩展时不需要安装 Playwright、Puppeteer 或其他运行时。

开发范围、平台批次和适配边界见 [`docs/development.md`](docs/development.md)；问题、根因、方案与性能变化见 [`docs/problem-solution-performance.md`](docs/problem-solution-performance.md)。

## 本地验收

1. 直接用 Chrome 打开 `demo/boss-mock.html`。
2. 加载 `dist` 扩展后刷新演示页面。
3. 页面右下角会出现“投递准备”浮层；匹配岗位会显示分数和“加入投递准备”。
4. 点击扩展图标查看队列、编辑筛选条件、复制招呼语。

```bash
pnpm typecheck
pnpm build
pnpm test
```

## 后续可扩展

- 增加岗位详情页的人工填充助手。
- 增加 CSV 导入/导出和重复岗位去重。
- 增加用户明确授权后的本地 AI 招呼语生成；默认不上传完整简历。
