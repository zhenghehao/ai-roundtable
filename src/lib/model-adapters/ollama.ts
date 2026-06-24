import type { ModelInput, ModelResponse } from "@/lib/types";
import { trimTrailingSlash } from "@/lib/utils";
import { extractErrorDetail, ModelAdapterError } from "./errors";
import { withModelRequestRetries } from "./retry";

function normalizeOllamaBaseUrl(value: string) {
  const baseUrl = trimTrailingSlash(value.trim() || "http://127.0.0.1:11434");
  return baseUrl.endsWith("/v1") ? baseUrl.slice(0, -3) : baseUrl;
}

export async function callOllama(input: ModelInput): Promise<ModelResponse> {
  const baseUrl = normalizeOllamaBaseUrl(input.provider.baseUrl);
  const model = (input.model || input.provider.defaultModel).trim();

  if (!model) {
    throw new ModelAdapterError("请先在模型配置中选择一个 Ollama 已下载模型。");
  }

  return withModelRequestRetries(async (signal) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: input.systemPrompt
          },
          ...input.messages.map((message) => ({
            role: message.role,
            content: message.content
          }))
        ],
        stream: false
      })
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = extractErrorDetail(payload);
      throw new ModelAdapterError(
        detail ? `Ollama 调用失败：${detail}` : "Ollama 调用失败，请确认本地服务已启动且模型已下载。",
        {
          status: response.status,
          detail
        }
      );
    }

    const content = String(payload?.message?.content || payload?.response || "").trim();
    if (!content) {
      throw new ModelAdapterError("Ollama 已返回，但没有找到可识别的回复内容。");
    }

    return {
      content,
      raw: payload
    };
  }, input.signal);
}
