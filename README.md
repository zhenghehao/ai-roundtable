# AI圆桌

AI圆桌是一个本地优先的中文 AI 群聊讨论应用。用户可以配置不同大模型 API，创建多个 AI 角色，再把角色加入不同群聊房间，让它们像群聊一样围绕话题轮流讨论，并生成总结。

第一版不需要登录，也不需要数据库。模型配置、角色、房间和聊天记录都保存在浏览器 `localStorage` 中。

## 功能特点

- 模型供应商配置：支持 OpenAI Compatible 和 Anthropic Claude。
- 内置供应商模板：OpenAI、DeepSeek、通义千问、Kimi、GLM、豆包、千帆、混元、MiniMax、StepFun、Gemini、Grok、Claude 等。
- 角色管理：支持自定义角色身份、发言风格、头像颜色、本地头像、默认模型。
- 多群聊房间：每个房间有独立角色、轮数和聊天记录。
- 圆桌讨论：角色按顺序轮流发言，可继续一轮、停止、生成总结。
- 历史记录：支持导出 JSON、Markdown、TXT，也支持导入 JSON。
- 多语言界面：支持中文、英语、日语、西班牙语、法语、德语、葡萄牙语、俄语、阿拉伯语、韩语、意大利语、荷兰语。
- 桌面打包：支持生成 macOS 和 Windows 版本。

## 隐私说明

- API Key 只保存在当前浏览器或本地桌面应用环境。
- 项目不包含登录、数据库或云同步。
- 不会把 API Key 写入服务端数据库，也不会主动打印到控制台。
- 请不要把自己的 `.env`、打包产物或包含个人 API Key 的浏览器数据提交到 GitHub。

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

## 开源发布建议

1. 在 GitHub 创建一个公开仓库，例如 `ai-roundtable`。
2. 只提交源码和配置文件，不提交 `node_modules/`、`.next/`、`out/`、`release/`。
3. 把 macOS / Windows 安装包上传到 GitHub Releases。
4. 在 README 中放几张界面截图，会更方便别人理解项目。

## License

MIT
