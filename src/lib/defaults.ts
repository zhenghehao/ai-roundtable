import type { AgentRole, AppState, ChatRoom, ProviderTemplate } from "@/lib/types";
import { defaultLanguageCode } from "@/lib/languages";
import { nowIso } from "@/lib/utils";

export const FILE_MASTER_ROLE_ID = "role-file-master";

export const providerTemplates: ProviderTemplate[] = [
  {
    name: "OpenAI",
    protocol: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    recommendedModels: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5"]
  },
  {
    name: "DeepSeek",
    protocol: "openai-compatible",
    baseUrl: "https://api.deepseek.com",
    recommendedModels: ["deepseek-v4-flash", "deepseek-v4-pro"]
  },
  {
    name: "Qwen 通义千问",
    protocol: "openai-compatible",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    recommendedModels: ["qwen3-max", "qwen-plus", "qwen-flash", "qwen3-coder-plus"]
  },
  {
    name: "Kimi",
    protocol: "openai-compatible",
    baseUrl: "https://api.moonshot.cn/v1",
    recommendedModels: ["kimi-k2-0711-preview", "moonshot-v1-8k", "moonshot-v1-32k"]
  },
  {
    name: "GLM 智谱",
    protocol: "openai-compatible",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    recommendedModels: ["glm-5.1", "glm-5-turbo", "glm-4.7"]
  },
  {
    name: "豆包火山方舟",
    protocol: "openai-compatible",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    recommendedModels: ["doubao-seed-1.6", "doubao-seed-code"]
  },
  {
    name: "百度千帆",
    protocol: "openai-compatible",
    baseUrl: "https://qianfan.baidubce.com/v2",
    recommendedModels: ["ernie-4.0-turbo-8k", "ernie-3.5-8k"]
  },
  {
    name: "腾讯混元",
    protocol: "openai-compatible",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    recommendedModels: ["hunyuan-turbos-latest"]
  },
  {
    name: "MiniMax",
    protocol: "openai-compatible",
    baseUrl: "https://api.minimaxi.com/v1",
    recommendedModels: ["MiniMax-M2.7", "MiniMax-M2.7-highspeed"]
  },
  {
    name: "阶跃星辰 StepFun",
    protocol: "openai-compatible",
    baseUrl: "https://api.stepfun.ai/v1",
    recommendedModels: []
  },
  {
    name: "Gemini",
    protocol: "openai-compatible",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    recommendedModels: ["gemini-3-flash-preview"]
  },
  {
    name: "Grok xAI",
    protocol: "openai-compatible",
    baseUrl: "https://api.x.ai/v1",
    recommendedModels: ["grok-4", "grok-4.20-reasoning"]
  },
  {
    name: "Claude",
    protocol: "anthropic",
    baseUrl: "https://api.anthropic.com",
    recommendedModels: ["claude-opus-4-7", "claude-sonnet-4-5"]
  }
];

export const rolePresets: Array<Pick<AgentRole, "id" | "name" | "avatarColor" | "systemPrompt" | "speakingStyle" | "enabled">> = [
  {
    id: "role-host",
    name: "主持人",
    avatarColor: "#0f766e",
    systemPrompt:
      "你是这场 AI 圆桌讨论的主持人。你的目标是引导讨论、控制节奏、提出关键问题，并在必要时做阶段总结。你需要让每位角色都围绕主题推进，不要空泛寒暄。",
    speakingStyle: "清晰、克制、善于追问，必要时用列表整理讨论方向。",
    enabled: true
  },
  {
    id: "role-product",
    name: "产品经理",
    avatarColor: "#2563eb",
    systemPrompt:
      "你是产品经理。你的目标是关注用户需求、商业价值、产品边界、使用门槛和用户体验。你需要把抽象想法转成可落地的产品判断。",
    speakingStyle: "用户视角强，表达简洁，偏重取舍、优先级和体验细节。",
    enabled: true
  },
  {
    id: "role-tech",
    name: "技术专家",
    avatarColor: "#7c3aed",
    systemPrompt:
      "你是技术专家。你的目标是关注实现方案、架构设计、技术风险、开发成本和可维护性。你需要指出实现路径和关键约束。",
    speakingStyle: "务实、准确、工程化，避免炫技，优先给出简单可维护的方案。",
    enabled: true
  },
  {
    id: "role-opponent",
    name: "反对者",
    avatarColor: "#dc2626",
    systemPrompt:
      "你是反对者。你的目标是提出质疑、反例、风险、隐藏成本和被忽视的问题。你不是为了否定而否定，而是帮助团队减少盲区。",
    speakingStyle: "直接、冷静、证据导向，提出问题后给出可验证的检查方式。",
    enabled: true
  },
  {
    id: "role-summary",
    name: "总结员",
    avatarColor: "#c2410c",
    systemPrompt:
      "你是总结员。你的目标是提炼共识、分歧、风险、行动项和最终结论。你需要避免重复长篇原话，用结构化方式收束讨论。",
    speakingStyle: "结构清楚、短句、结论先行，适合输出最终摘要。",
    enabled: true
  },
  {
    id: "role-creative",
    name: "创意顾问",
    avatarColor: "#0891b2",
    systemPrompt:
      "你是创意顾问。你的目标是提出新颖方向、差异化思路和发散方案，同时把创意和当前讨论目标连接起来。",
    speakingStyle: "开放、灵活、富有想象力，但每次至少落到一个具体建议。",
    enabled: true
  },
  {
    id: FILE_MASTER_ROLE_ID,
    name: "文件大师",
    avatarColor: "#4f46e5",
    systemPrompt:
      "你是文件大师。你的职责不是参与普通头脑风暴，而是在用户明确 @你 或要求最终交付文件时，读取前面的完整讨论上下文，把共识、结论、文章、方案或表格整合成可下载文件。你需要决定合适的文件类型，并用文件块输出。Word 文件请使用 docx，普通文本用 txt，结构化方案用 md，表格数据用 csv 或 xlsx，网页稿用 html。生成 Word 时需要考虑文档排版，使用清晰标题层级、字号和字体。",
    speakingStyle:
      "交付导向、细致、像专业文档编辑。先用一句话说明已整理，然后输出文件块；不要把每个中间回复都转成文件。",
    enabled: true
  }
];

export function createDefaultRoles(createdAt = nowIso()): AgentRole[] {
  return rolePresets.map((role) => ({
    ...role,
    providerId: "",
    model: "",
    createdAt,
    updatedAt: createdAt
  }));
}

export function createDefaultRoom(roles: AgentRole[], createdAt = nowIso()): ChatRoom {
  return {
    id: "room-default",
    name: "默认圆桌",
    mode: "group",
    roleIds: roles.filter((role) => role.id !== FILE_MASTER_ROLE_ID).map((role) => role.id),
    defaultRounds: 2,
    messages: [],
    createdAt,
    updatedAt: createdAt
  };
}

export function createDefaultAppState(): AppState {
  const createdAt = nowIso();
  const roles = createDefaultRoles(createdAt);
  const defaultRoom = createDefaultRoom(roles, createdAt);

  return {
    providers: [],
    roles,
    rooms: [defaultRoom],
    activeRoomId: defaultRoom.id,
    settings: {
      language: defaultLanguageCode
    },
    version: 1
  };
}
