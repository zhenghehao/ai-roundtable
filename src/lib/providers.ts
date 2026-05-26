import type { ProviderConfig } from "@/lib/types";
import { trimTrailingSlash } from "@/lib/utils";

const endpointMigrations = [
  {
    namePattern: /(kimi|moonshot)/i,
    from: "https://api.moonshot.ai/v1",
    to: "https://api.moonshot.cn/v1"
  },
  {
    namePattern: /minimax/i,
    from: "https://api.minimax.io/v1",
    to: "https://api.minimaxi.com/v1"
  }
];

export function normalizeKnownProviderEndpoint<T extends Pick<ProviderConfig, "name" | "baseUrl">>(provider: T): T {
  const baseUrl = trimTrailingSlash(provider.baseUrl);
  const migration = endpointMigrations.find(
    (item) => item.namePattern.test(provider.name || "") && baseUrl === item.from
  );

  if (!migration) {
    return provider;
  }

  return {
    ...provider,
    baseUrl: migration.to
  };
}

export function getProviderConfigurationHints(provider: Pick<ProviderConfig, "name" | "baseUrl">) {
  const name = provider.name || "";
  const baseUrl = trimTrailingSlash(provider.baseUrl || "");
  const hints: string[] = [];

  if (/(kimi|moonshot)/i.test(name) || /moonshot/i.test(baseUrl)) {
    hints.push("Kimi 中国区 API Key 通常应使用 Base URL：https://api.moonshot.cn/v1。");
    hints.push("如果你的 Key 来自海外/国际平台，请确认是否需要使用对应海外端点。");
  }

  if (/minimax/i.test(name) || /minimax|minimaxi/i.test(baseUrl)) {
    hints.push("MiniMax 中国区 Token Plan Key 通常应使用 Base URL：https://api.minimaxi.com/v1。");
    hints.push("MiniMax 国际区和中国区端点不能混用，端点区域不匹配时常见 401 或 token unusable。");
  }

  if (/qwen|通义|百炼|dashscope/i.test(name) || /dashscope/i.test(baseUrl)) {
    hints.push("Qwen/百炼 API Key 与地域有关，请确认 Base URL 和控制台区域一致。");
  }

  if (/doubao|豆包|火山|方舟|volc|ark/i.test(name) || /volces/i.test(baseUrl)) {
    hints.push("火山方舟普通在线推理通常使用 /api/v3；特殊套餐请按控制台文档确认路径。");
  }

  if (/gemini|google/i.test(name) || /generativelanguage/i.test(baseUrl)) {
    hints.push("Gemini OpenAI 兼容地址末尾是 /v1beta/openai，应用会自动拼接 /chat/completions。");
  }

  return hints;
}
