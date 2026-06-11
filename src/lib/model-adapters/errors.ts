import { getProviderConfigurationHints } from "@/lib/providers";
import type { ProviderConfig } from "@/lib/types";

export class ModelAdapterError extends Error {
  friendlyMessage: string;
  status?: number;
  retryAfterMs?: number;

  constructor(friendlyMessage: string, options?: { status?: number; detail?: string; retryAfterMs?: number }) {
    super(options?.detail || friendlyMessage);
    this.name = "ModelAdapterError";
    this.friendlyMessage = friendlyMessage;
    this.status = options?.status;
    this.retryAfterMs = options?.retryAfterMs;
  }
}

export function toFriendlyError(error: unknown): string {
  if (error instanceof ModelAdapterError) {
    return error.friendlyMessage;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return "讨论已停止。";
  }

  if (error instanceof TypeError) {
    return "网络异常或 Base URL 无法访问，请检查地址、网络和浏览器跨域限制。";
  }

  if (error instanceof Error) {
    return cleanDesktopErrorMessage(error.message || "") || "请求失败，请稍后再试。";
  }

  return "请求失败，请稍后再试。";
}

export function friendlyMessageFromStatus(status: number, detail?: string) {
  const normalizedDetail = detail || "";

  if (status === 401 || status === 403) {
    if (/token is unusable|invalid.*token|unauthorized|authentication/i.test(normalizedDetail)) {
      return "API Key 无效、区域端点不匹配，或当前账号没有访问权限。";
    }

    return "API Key 错误、无效，或当前账号没有访问权限。";
  }

  if (status === 404) {
    return "模型名不存在、Base URL 路径不正确，或当前账号无权访问该模型。";
  }

  if (status === 429) {
    return "请求过于频繁，已触发供应商限流。请稍后再试，或降低连续调用频率。";
  }

  if (status === 408 || status === 504) {
    return "请求超时，供应商响应较慢或网络不稳定。请稍后重试。";
  }

  if (status === 402 || /quota|credit|balance|insufficient/i.test(normalizedDetail)) {
    return "额度不足，请检查供应商账号余额或套餐。";
  }

  if (status >= 500) {
    return "供应商服务暂时不可用，请稍后再试。";
  }

  if (/model.*not.*found|does not exist|permission|无权|模型不存在/i.test(normalizedDetail)) {
    return "模型名不存在，或当前账号没有该模型的调用权限。";
  }

  if (/invalid url|base url|not found/i.test(normalizedDetail)) {
    return "Base URL 不正确，请检查域名、协议和路径是否与供应商文档一致。";
  }

  if (normalizedDetail) {
    return `请求失败：${normalizedDetail}`;
  }

  return "请求失败，请检查模型配置后重试。";
}

export function extractErrorDetail(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const data = payload as Record<string, unknown>;
  const error = data.error;

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const errorObject = error as Record<string, unknown>;
    if (typeof errorObject.message === "string") {
      return errorObject.message;
    }
    if (typeof errorObject.type === "string") {
      return errorObject.type;
    }
  }

  if (typeof data.message === "string") {
    return data.message;
  }

  return "";
}

function cleanDesktopErrorMessage(message: string) {
  return message
    .replace(/^Error invoking remote method '[^']+': Error:\s*/i, "")
    .replace(/^Error invoking remote method "[^"]+": Error:\s*/i, "")
    .trim();
}

function getRawErrorMessage(error: unknown) {
  if (error instanceof ModelAdapterError) {
    return cleanDesktopErrorMessage(error.message || error.friendlyMessage);
  }

  if (error instanceof Error) {
    return cleanDesktopErrorMessage(error.message || "");
  }

  return typeof error === "string" ? cleanDesktopErrorMessage(error) : "";
}

export function buildConnectionTestReport(error: unknown, provider: Pick<ProviderConfig, "name" | "baseUrl" | "defaultModel" | "protocol">) {
  const friendlyMessage = toFriendlyError(error);
  const rawMessage = getRawErrorMessage(error);
  const status = error instanceof ModelAdapterError ? error.status : undefined;
  const suggestions = new Set<string>();
  const searchable = `${friendlyMessage}\n${rawMessage}`.toLowerCase();

  if (provider.protocol === "local-cli") {
    const nodePathFailure = /env:\s*node|node:\s*no such file/i.test(searchable);

    return [
      "本地 CLI 测试失败",
      "",
      `可能原因：${friendlyMessage}`,
      rawMessage && rawMessage !== friendlyMessage ? `原始信息：${rawMessage}` : "",
      "",
      "建议处理：",
      "1. 确认 CLI 已安装，并能在普通终端中直接启动。",
      "2. 先在对应 CLI 中完成官方登录或 API Key 配置。",
      nodePathFailure
        ? "3. 这是旧版桌面应用的 Node 路径问题；请安装新版体验版后重新测试。"
        : "3. 若使用自定义 CLI，可填写完整命令路径；应用会自动补齐常见的 Node 和 CLI 目录。",
      "4. Kiro Headless 通常需要 KIRO_API_KEY；OpenClaw 需要安装 CLI 并先完成模型认证。",
      "",
      `当前配置：${provider.name || "未命名本地 CLI"}`
    ]
      .filter(Boolean)
      .join("\n");
  }

  getProviderConfigurationHints(provider).forEach((hint) => suggestions.add(hint));

  if (/api key|token|unauthorized|authentication|401|403|无效|权限|区域/.test(searchable)) {
    suggestions.add("确认 API Key 没有复制多余空格，并且来自当前 Base URL 对应的同一区域平台。");
    suggestions.add("如果刚创建 Key，建议在供应商控制台确认它已启用并有模型调用权限。");
  }

  if (/base url|invalid url|404|not found|无法访问|network|fetch/.test(searchable)) {
    suggestions.add("确认 Base URL 只填到版本路径，例如 OpenAI 兼容接口通常填到 /v1，不要额外写 /chat/completions。");
    suggestions.add("确认当前网络可以访问该域名，必要时切换网络或代理后再测试。");
  }

  if (/model|模型|permission|无权/.test(searchable)) {
    suggestions.add("确认默认模型名拼写完全正确，并且当前账号已经开通该模型。");
  }

  if (/429|rate|频繁|限流/.test(searchable)) {
    suggestions.add("该供应商触发限流时，稍等 30-60 秒再试；群聊里多个角色共用同一个 Key 时尤其容易触发。");
  }

  if (/quota|credit|balance|insufficient|额度|余额|402/.test(searchable)) {
    suggestions.add("检查供应商账号余额、免费额度或套餐是否可用。");
  }

  if (/timeout|超时|504|408/.test(searchable)) {
    suggestions.add("请求超时通常是网络波动或供应商繁忙，可以稍后重试，或临时换成更快的模型。");
  }

  if (suggestions.size === 0) {
    suggestions.add("先确认 API Key、Base URL、默认模型三项是否和供应商官方文档完全一致。");
  }

  return [
    "连接测试失败",
    "",
    `可能原因：${friendlyMessage}`,
    status ? `HTTP 状态码：${status}` : "",
    rawMessage && rawMessage !== friendlyMessage ? `原始信息：${rawMessage}` : "",
    "",
    "建议处理：",
    ...Array.from(suggestions).map((item, index) => `${index + 1}. ${item}`),
    "",
    "当前测试配置：",
    `服务商：${provider.name || "未命名服务商"}`,
    `协议：${provider.protocol === "anthropic" ? "Anthropic Claude" : "OpenAI 兼容"}`,
    `Base URL：${provider.baseUrl || "未填写"}`,
    `模型：${provider.defaultModel || "未填写"}`
  ]
    .filter(Boolean)
    .join("\n");
}
