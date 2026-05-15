export class ModelAdapterError extends Error {
  friendlyMessage: string;
  status?: number;

  constructor(friendlyMessage: string, options?: { status?: number; detail?: string }) {
    super(options?.detail || friendlyMessage);
    this.name = "ModelAdapterError";
    this.friendlyMessage = friendlyMessage;
    this.status = options?.status;
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
    return error.message || "请求失败，请稍后再试。";
  }

  return "请求失败，请稍后再试。";
}

export function friendlyMessageFromStatus(status: number, detail?: string) {
  if (status === 401 || status === 403) {
    return "API Key 错误、无效，或当前账号没有访问权限。";
  }

  if (status === 404) {
    return "模型名不存在、Base URL 不正确，或当前账号无权访问该模型。";
  }

  if (status === 429) {
    return "请求过于频繁，请稍后再试。";
  }

  if (status === 402 || /quota|credit|balance|insufficient/i.test(detail || "")) {
    return "额度不足，请检查供应商账号余额或套餐。";
  }

  if (status >= 500) {
    return "供应商服务暂时不可用，请稍后再试。";
  }

  if (detail) {
    return `请求失败：${detail}`;
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
