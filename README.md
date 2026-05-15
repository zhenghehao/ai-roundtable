# AI Roundtable

[中文说明](./README.zh-CN.md)

AI Roundtable is a local-first multi-agent discussion app. It lets you configure model providers, create AI roles, start roundtable-style group discussions, and generate structured summaries.

The first version is designed for local, single-user use. No login, database, or cloud sync is required. Provider configs, roles, rooms, and chat history are stored in browser `localStorage`.

## Why AI Roundtable?

Most AI chat tools are built around one assistant. AI Roundtable is built around a group of roles.

You can create a host, product manager, technical expert, skeptic, summarizer, creative advisor, or any role you need. Then you can let them discuss a topic in turns, like a small roundtable meeting.

It is useful for:

- Product reviews
- Startup idea evaluation
- Technical design discussions
- Writing and content brainstorming
- Decision making
- Risk analysis
- Meeting-style summaries

## Features

- Local-first storage for model configs, roles, rooms, and chat history.
- Model provider management with API key, Base URL, protocol, default model, and notes.
- Supports OpenAI Compatible and Anthropic Claude protocols.
- Built-in provider templates for OpenAI, DeepSeek, Qwen, Kimi, GLM, Doubao, Qianfan, Hunyuan, MiniMax, StepFun, Gemini, Grok, Claude, and more.
- Custom AI roles with identity prompts, speaking style, avatar color, local avatar image, provider, and model.
- Multiple chat rooms with independent participants, rounds, and history.
- Roundtable discussion flow where enabled roles speak in order.
- Continue one more round, stop generation, clear a room, copy/delete messages, and generate summaries.
- Export chat history as JSON, Markdown, or TXT.
- Import JSON history back into a room.
- Multi-language UI, including English, Simplified Chinese, Traditional Chinese, Japanese, Spanish, French, German, Portuguese, Russian, Arabic, Korean, Italian, and Dutch.
- Desktop packaging for macOS and Windows through Electron.

## Privacy

- API keys are stored only in your local browser or local desktop app environment.
- There is no login system, database, or cloud sync in the first version.
- The app does not store API keys on a server and does not intentionally print them to the console.
- Do not commit `.env` files, release builds, or browser data containing personal API keys.

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Electron
- localStorage

## Getting Started

```bash
npm install
npm run dev
```

The local development URL is usually:

```text
http://localhost:3000
```

If the port is already in use, choose another port:

```bash
npm run dev -- -p 3001
```

## Build Web App

```bash
npm run build
```

The static output is generated in `out/`.

## Build Desktop Apps

macOS:

```bash
npm run dist:mac
```

Windows:

```bash
npm run dist:win
```

Build artifacts are generated in `release/`. Do not commit `release/` to the source repository. Upload desktop packages to GitHub Releases instead.

## Project Structure

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

## Roadmap Ideas

- Streaming model responses.
- More discussion templates.
- Better role presets for product, engineering, writing, research, and business scenarios.
- Exportable meeting reports.
- Screenshot and demo video assets for the README.
- Optional cloud sync or team mode in the future.

## License

MIT
