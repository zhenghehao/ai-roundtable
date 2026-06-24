import type { LocalCliConfig, ProviderConfig, ProviderProtocol } from "@/lib/types";
import { nowIso } from "@/lib/utils";

type BuiltinLocalAgent = {
  id: string;
  name: string;
  note: string;
  protocol?: ProviderProtocol;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  localCli: LocalCliConfig;
};

export const builtinLocalAgents: BuiltinLocalAgent[] = [
  {
    id: "local-ollama",
    name: "Ollama（本地下载模型）",
    note: "自动检测 Ollama 本地服务，并读取已下载模型列表。默认地址：http://127.0.0.1:11434。",
    protocol: "ollama",
    baseUrl: "http://127.0.0.1:11434",
    localCli: {
      agentId: "ollama",
      commandCandidates: ["ollama", "/Applications/Ollama.app/Contents/Resources/ollama"],
      detectionPaths: ["/Applications/Ollama.app", "~/.ollama"],
      args: [],
      inputMode: "stdin",
      outputFormat: "text",
      capability: "adapted",
      builtIn: true
    }
  },
  {
    id: "local-lmstudio",
    name: "LM Studio（本地服务）",
    note: "连接 LM Studio 的本地 OpenAI 兼容服务，并读取 /v1/models 返回的本地模型。默认地址：http://127.0.0.1:1234/v1。",
    protocol: "openai-compatible",
    baseUrl: "http://127.0.0.1:1234/v1",
    apiKey: "lm-studio",
    localCli: {
      agentId: "lmstudio",
      commandCandidates: ["lms"],
      detectionPaths: ["/Applications/LM Studio.app", "~/.lmstudio", "~/.cache/lm-studio"],
      args: [],
      inputMode: "stdin",
      outputFormat: "text",
      capability: "adapted",
      builtIn: true
    }
  },
  {
    id: "local-codex",
    name: "Codex CLI（本地）",
    note: "官方 Headless CLI，圆桌默认以只读沙箱运行。",
    localCli: {
      agentId: "codex",
      commandCandidates: ["codex", "/Applications/Codex.app/Contents/Resources/codex"],
      detectionPaths: ["/Applications/Codex.app", "~/.codex"],
      args: [],
      inputMode: "stdin",
      outputFormat: "text",
      capability: "adapted",
      builtIn: true
    }
  },
  {
    id: "local-claude",
    name: "Claude Code（本地）",
    note: "官方 Headless CLI，圆桌禁用工具并仅用于分析和发言。",
    localCli: {
      agentId: "claude",
      commandCandidates: ["claude"],
      detectionPaths: ["/Applications/Claude.app", "~/.claude"],
      args: [],
      inputMode: "stdin",
      outputFormat: "json",
      resultPath: "result",
      capability: "adapted",
      builtIn: true
    }
  },
  {
    id: "local-kiro",
    name: "Kiro CLI（本地）",
    note: "官方 Headless CLI。无头模式通常需要 KIRO_API_KEY 和支持该功能的套餐。",
    localCli: {
      agentId: "kiro",
      commandCandidates: ["kiro-cli", "/Applications/Kiro CLI.app/Contents/MacOS/kiro-cli"],
      detectionPaths: ["/Applications/Kiro CLI.app", "~/.kiro"],
      args: [],
      inputMode: "argument",
      outputFormat: "text",
      capability: "adapted",
      builtIn: true
    }
  },
  {
    id: "local-gemini",
    name: "Gemini CLI（本地）",
    note: "官方 Headless CLI，圆桌使用 plan 只读审批模式。",
    localCli: {
      agentId: "gemini",
      commandCandidates: ["gemini"],
      detectionPaths: ["~/.gemini", "~/.config/gemini"],
      args: [],
      inputMode: "stdin",
      outputFormat: "json",
      resultPath: "response",
      capability: "adapted",
      builtIn: true
    }
  },
  {
    id: "local-codebuddy",
    name: "CodeBuddy Code（腾讯，本地）",
    note: "腾讯官方 CLI，支持 Headless、JSON、会话恢复和 ACP。",
    localCli: {
      agentId: "codebuddy",
      commandCandidates: ["codebuddy", "cbc"],
      detectionPaths: ["~/.codebuddy", "~/.config/codebuddy"],
      args: [],
      inputMode: "stdin",
      outputFormat: "json",
      resultPath: "result",
      capability: "adapted",
      builtIn: true
    }
  },
  {
    id: "local-hermes",
    name: "Hermes Agent（本地）",
    note: "自动检测并使用 One-shot 模式接入；忽略本地规则和记忆，仅保留视觉分析工具。",
    localCli: {
      agentId: "hermes",
      commandCandidates: ["hermes"],
      detectionPaths: ["~/.hermes"],
      args: [],
      inputMode: "argument",
      outputFormat: "text",
      capability: "adapted",
      builtIn: true
    }
  },
  {
    id: "local-openclaw",
    name: "OpenClaw（本地）",
    note: "自动检测并使用官方 Infer 模型入口接入；读取已配置的默认模型，不启动工具、记忆、MCP 或 Gateway。",
    localCli: {
      agentId: "openclaw",
      commandCandidates: ["openclaw"],
      detectionPaths: ["~/.openclaw"],
      args: [],
      inputMode: "argument",
      outputFormat: "json",
      capability: "adapted",
      builtIn: true
    }
  }
];

export function createBuiltinLocalProviders(createdAt = nowIso()): ProviderConfig[] {
  return builtinLocalAgents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    protocol: agent.protocol || "local-cli",
    baseUrl: agent.baseUrl || "",
    apiKey: agent.apiKey || "",
    defaultModel: agent.defaultModel || "",
    note: agent.note,
    localCli: agent.localCli,
    createdAt,
    updatedAt: createdAt
  }));
}

export function refreshBuiltinLocalProvider(provider: ProviderConfig): ProviderConfig {
  const builtin = createBuiltinLocalProviders(provider.createdAt).find((item) => item.id === provider.id);
  if (!builtin) {
    return provider;
  }

  return {
    ...provider,
    name: builtin.name,
    protocol: builtin.protocol,
    baseUrl: builtin.baseUrl,
    apiKey: builtin.apiKey,
    note: builtin.note,
    localCli: builtin.localCli
  };
}
