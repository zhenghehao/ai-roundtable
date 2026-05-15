# AI圆桌

[English README](./README.md)

AI圆桌是一个本地优先的 AI 多角色圆桌讨论应用。用户可以配置不同大模型 API，创建多个 AI 角色，再把角色加入不同群聊房间，让它们像群聊一样围绕话题轮流讨论，并生成结构化总结。

第一版面向本地单机使用，不需要登录，也不需要数据库。模型配置、角色、房间和聊天记录都保存在浏览器 `localStorage` 中。

## 为什么做 AI圆桌？

大多数 AI 聊天工具都是围绕一个助手设计的。AI圆桌则围绕一组角色设计。

你可以创建主持人、产品经理、技术专家、反对者、总结员、创意顾问，或者任何你需要的角色。然后让它们围绕一个话题轮流讨论，就像开一场小型圆桌会议。

适合这些场景：

- 产品评审
- 创业点子评估
- 技术方案讨论
- 写作和内容选题
- 决策推演
- 风险分析
- 会议式总结

## 功能特点

- 本地优先保存：模型配置、角色、房间和聊天记录保存在本地。
- 模型供应商配置：支持 API Key、Base URL、协议类型、默认模型和备注。
- 支持 OpenAI Compatible 和 Anthropic Claude 协议。
- 内置供应商模板：OpenAI、DeepSeek、通义千问、Kimi、GLM、豆包、千帆、混元、MiniMax、StepFun、Gemini、Grok、Claude 等。
- 角色管理：支持自定义身份提示词、发言风格、头像颜色、本地头像、供应商和模型。
- 多群聊房间：每个房间拥有独立参与角色、讨论轮数和聊天历史。
- 圆桌讨论：启用角色按顺序轮流发言。
- 支持继续一轮、停止、清空房间、复制/删除消息、生成总结。
- 支持导出 JSON、Markdown、TXT。
- 支持导入 JSON 聊天历史。
- 多语言界面：支持英语、简体中文、繁体中文、日语、西班牙语、法语、德语、葡萄牙语、俄语、阿拉伯语、韩语、意大利语、荷兰语。
- 支持通过 Electron 打包 macOS 和 Windows 桌面应用。

## 隐私说明

- API Key 只保存在当前浏览器或本地桌面应用环境。
- 第一版不包含登录、数据库或云同步。
- 不会把 API Key 写入服务端数据库，也不会主动打印到控制台。
- 请不要把 `.env` 文件、打包产物或包含个人 API Key 的浏览器数据提交到 GitHub。

## 技术栈

- Next.js
- React
- TypeScript
- Tailwind CSS
- Electron
- localStorage

## 本地开发

```bash
npm install
npm run dev
```

默认开发地址通常是：

```text
http://localhost:3000
```

如果端口被占用，可以指定新端口：

```bash
npm run dev -- -p 3001
```

## 构建网页版本

```bash
npm run build
```

构建结果会输出到 `out/` 目录。

## 打包桌面应用

macOS：

```bash
npm run dist:mac
```

Windows：

```bash
npm run dist:win
```

生成结果会放在 `release/` 目录。建议不要把 `release/` 提交到源码仓库，可以把安装包上传到 GitHub Releases。

## 项目结构

```text
src/
  app/
  components/
    chat/
    history/
    providers/
    roles/
    settings/
    ui/
  lib/
    model-adapters/
    storage/
    types/
    utils/
electron/
scripts/
```

## 后续方向

- 流式输出。
- 更多讨论场景模板。
- 更丰富的产品、技术、写作、研究和商业角色预设。
- 可导出的会议报告。
- README 截图和演示视频。
- 未来可选的云同步或团队模式。

## License

MIT
