import type { ModelInput, ModelResponse } from "@/lib/types";
import { trimTrailingSlash } from "@/lib/utils";
import { extractErrorDetail, friendlyMessageFromStatus, ModelAdapterError } from "./errors";

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

function normalizeOpenAIContent(content: OpenAIChatResponse["choices"]) {
  const firstContent = content?.[0]?.message?.content;

  if (typeof firstContent === "string") {
    return firstContent.trim();
  }

  if (Array.isArray(firstContent)) {
    return firstContent
      .map((part) => (part.type === "text" || !part.type ? part.text || "" : ""))
      .join("")
      .trim();
  }

  return "";
}

export async function callOpenAICompatible(input: ModelInput): Promise<ModelResponse> {
  const apiKey = input.provider.apiKey.trim();
  const baseUrl = trimTrailingSlash(input.provider.baseUrl.trim());
  const model = (input.model || input.provider.defaultModel).trim();

  if (!baseUrl) {
    throw new ModelAdapterError("请先填写 Base URL。");
  }

  if (!apiKey) {
    throw new ModelAdapterError("请先填写 API Key。API Key 只会保存在你的浏览器本地。");
  }

  if (!model) {
    throw new ModelAdapterError("请先填写模型名。");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal: input.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: input.systemPrompt
        },
        ...input.messages
      ],
      temperature: 0.7
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

  const content = normalizeOpenAIContent((payload as OpenAIChatResponse | null)?.choices);

  if (!content) {
    throw new ModelAdapterError("返回格式不符合预期，没有找到模型回复内容。");
  }

  return {
    content,
    raw: payload
  };
}
