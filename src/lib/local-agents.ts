import type { LocalCliConfig, ProviderConfig } from "@/lib/types";
import { nowIso } from "@/lib/utils";

type BuiltinLocalAgent = {
  id: string;
  name: string;
  note: string;
  defaultModel?: string;
  localCli: LocalCliConfig;
};

export const builtinLocalAgents: BuiltinLocalAgent[] = [
  {
    id: "local-codex",
    name: "Codex CLI（本地）",
    note: "官方 Headless CLI，圆桌默认以只读沙箱运行。",
    localCli: {
      agentId: "codex",
      commandCandidates: ["codex"],
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
      commandCandidates: ["kiro-cli"],
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
    protocol: "local-cli",
    baseUrl: "",
    apiKey: "",
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
