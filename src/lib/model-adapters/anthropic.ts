import type { ModelInput, ModelMessage, ModelResponse } from "@/lib/types";
import { trimTrailingSlash } from "@/lib/utils";
import { extractErrorDetail, friendlyMessageFromStatus, ModelAdapterError } from "./errors";

interface AnthropicResponse {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
}

function getAnthropicMessages(messages: ModelMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content
  }));
}

function getAnthropicEndpoint(baseUrl: string) {
  const normalized = trimTrailingSlash(baseUrl.trim() || "https://api.anthropic.com");

  if (normalized.endsWith("/v1")) {
    return `${normalized}/messages`;
  }

  return `${normalized}/v1/messages`;
}

export async function callAnthropic(input: ModelInput): Promise<ModelResponse> {
  const apiKey = input.provider.apiKey.trim();
  const model = (input.model || input.provider.defaultModel).trim();

  if (!apiKey) {
    throw new ModelAdapterError("请先填写 API Key。API Key 只会保存在你的浏览器本地。");
  }

  if (!model) {
    throw new ModelAdapterError("请先填写模型名。");
  }

  const response = await fetch(getAnthropicEndpoint(input.provider.baseUrl), {
    method: "POST",
    signal: input.signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      system: input.systemPrompt,
      max_tokens: 2048,
      messages: getAnthropicMessages(input.messages)
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = extractErrorDetail(payload);
    throw new ModelAdapterError(friendlyMessageFromStatus(response.status, detail), {
      status: response.status,
      detail
    });
  }

  const content = (payload as AnthropicResponse | null)?.content
    ?.filter((part) => part.type === "text" || !part.type)
    .map((part) => part.text || "")
    .join("")
    .trim();

  if (!content) {
    throw new ModelAdapterError("返回格式不符合预期，没有找到模型回复内容。");
  }

  return {
    content,
    raw: payload
  };
}
