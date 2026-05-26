# AI Roundtable

[中文说明](./README.zh-CN.md)

AI Roundtable turns a simple chat box into your own local AI team workspace. Create specialized roles, place them into group rooms or private chats, and use `@mentions` to route work from brainstorming to writing, review, summary, and final file delivery.

Instead of asking one assistant to do everything, you can assemble a team with a host, product manager, technical expert, creative advisor, writer, reviewer, editor, summarizer, and File Master. Each role keeps its own identity and speaking style, then collaborates in order to turn rough ideas into practical outputs.

It is built for people who want AI collaboration without accounts, databases, or a heavy backend. Your roles, rooms, chat history, and API keys stay on your device, while the interface stays simple enough for non-technical users.

## What Can It Do?

- Run roundtable-style AI group discussions.
- Create multiple AI roles with different identities, voices, goals, and model settings.
- Use `@role` task routing inside the chat box.
- Let several roles discuss for multiple rounds before handing work to the next role.
- Upload files and let models discuss file content.
- Generate structured summaries.
- Ask a dedicated File Master role to create downloadable files.
- Manage multiple rooms with independent history and participants.
- Use it as a local web app or packaged desktop app.

Example workflow:

```text
@Topic Expert @Creative Advisor Discuss for three rounds and choose a strong article topic.
Then @Summarizer summarize the final direction.
Then @Senior Writer write the article.
Then @Reviewer review the logic and risks.
Finally @File Master turn the final article into a Word document.
```

## Key Features

### Local-First Storage

AI Roundtable is designed for personal local use.

- No login required.
- No database required.
- No cloud sync in the first version.
- Provider configs, roles, rooms, and chat history are stored locally.
- API keys are kept only in the local browser or desktop app environment.

### Model Provider Configuration

You can add, edit, test, and delete model provider configs.

Supported protocol types:

- OpenAI Compatible
- Anthropic Claude

Built-in provider templates include:

- OpenAI
- DeepSeek
- Qwen
- Kimi
- GLM
- Doubao
- Baidu Qianfan
- Tencent Hunyuan
- MiniMax
- StepFun
- Gemini
- Grok xAI
- Claude

Each provider config can include:

- Display name
- Protocol
- Base URL
- API key
- Default model
- Notes

The role editor links model choices to the selected provider. If you choose a DeepSeek provider, the model dropdown will show DeepSeek-related models instead of leaving an old model from another provider.

### Role Management

Each AI role can have:

- Name
- Avatar color
- Local avatar image
- Identity prompt
- Speaking style
- Default provider config
- Default model
- Enabled or disabled status
- Markdown identity file

Markdown identity files are treated as high-priority role instructions. When a role has an uploaded identity file, the model reads that file on every reply. If the manual identity prompt or speaking style conflicts with the file, the uploaded file wins.

### Group Chat Rooms

You can create multiple group chat rooms. Each room keeps its own:

- Room name
- Participants
- Speaking order
- Default discussion rounds
- Chat history
- Created and updated time

When creating a group room, you can select which roles join and drag them to set the speaking order.

### Private Chats

Besides group chats, AI Roundtable supports one-on-one private chats with a single role.

This is useful for talking directly with a role such as:

- Strategy advisor
- Writing coach
- Product mentor
- Technical expert
- Investor-style reviewer

### `@Mention` Task Workflows

You can type `@` in the chat box to mention roles from the current room. AI Roundtable will follow the mentioned order instead of the default room order.

It also supports simple staged workflows. For example:

```text
@Product Manager @Creative Advisor Discuss for 3 rounds and decide a product direction.
Then @Summarizer summarize the final direction.
Then @Senior Writer write an article.
Then @Reviewer review it.
Then @Fixer revise it.
Finally @File Master create a Word document.
```

This becomes:

```text
Product Manager + Creative Advisor x 3 rounds
→ Summarizer
→ Senior Writer
→ Reviewer
→ Fixer
→ File Master
```

### Attachments

The chat input supports file uploads.

Supported formats include:

- PDF
- DOCX
- XLSX
- PPTX
- TXT
- MD
- CSV
- PNG
- JPG / JPEG
- WEBP
- HTML

For readable files, the app extracts text content and sends it to the model as context. For images, compatible multimodal models can receive image attachments.

### File Master And Downloadable Files

AI Roundtable includes a built-in role called File Master.

The File Master is not meant to join every normal discussion by default. Instead, add it to a room when you want final deliverables.

It can turn the final discussion result into downloadable files such as:

- Word document: `.docx`
- Excel spreadsheet: `.xlsx`
- Markdown: `.md`
- Text: `.txt`
- CSV: `.csv`
- HTML: `.html`

The chat UI recognizes file blocks returned by AI and turns them into download cards.

Example:

```text
<file name="Final Article.docx" type="docx" font="Microsoft YaHei" title-size="24" heading-size="16" body-size="11">
# Title
## Section
Body content...
</file>
```

The app will show a downloadable Word file card in the chat.

### History, Import, And Export

Each room saves its own chat history automatically.

You can:

- View room history
- Copy messages
- Delete single messages
- Clear the current room
- Export chat history as JSON
- Export chat history as Markdown
- Export chat history as TXT
- Import JSON history back into a room

### Multi-Language UI

The interface supports multiple languages, including:

- English
- Simplified Chinese
- Traditional Chinese
- Japanese
- Spanish
- French
- German
- Portuguese
- Russian
- Arabic
- Korean
- Italian
- Dutch

The selected language affects both the UI and future AI output instructions.

## Example Use Cases

### Content Creation

Use roles such as Topic Expert, Senior Writer, Reviewer, Fixer, Chief Editor, and File Master.

```text
@Topic Expert Give me 5 article ideas for beginner-friendly AI tools.
Then @Summarizer choose the most practical one.
Then @Senior Writer write the article.
Then @Reviewer check logic, tone, and risks.
Finally @File Master turn it into a Word document.
```

### Product Review

Use roles such as Product Manager, Technical Expert, Skeptic, Creative Advisor, and Summarizer.

```text
Should we build an AI group chat tool for non-technical users?
Discuss from user demand, technical cost, business value, and risk.
```

### Technical Planning

Let technical roles discuss architecture, implementation cost, model provider design, local storage, and packaging.

```text
@Technical Expert @Skeptic Discuss for two rounds:
Should the first version use only localStorage instead of a database?
Then @Summarizer give the final recommendation.
```

### Research And Reports

Upload documents, let roles discuss them, and ask File Master to create a report.

```text
Read the uploaded files, summarize the key points, identify risks, and create a Markdown report.
```

## Privacy

- API keys are stored locally.
- No account system is required.
- No database is required.
- The app does not intentionally print API keys to the console.
- Do not publish screenshots or config files that include private API keys.

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Electron
- Browser localStorage

## Getting Started

Install dependencies:

```bash
npm install
```

Start the local web app:

```bash
npm run dev
```

The default local URL is usually:

```text
http://localhost:3000
```

If the port is already in use:

```bash
npm run dev -- --port 3001
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

Build artifacts are generated in `release/`. Do not commit release binaries to the source repository. Upload desktop packages to GitHub Releases instead.

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

## Current Limitations

- Streaming output is not the default yet.
- File generation depends on model output format.
- Desktop builds are locally signed only unless you apply Apple or Microsoft signing.
- The first version is designed for single-user local use, not team sync.

## License

MIT
