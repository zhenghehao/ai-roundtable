import type { ModelInput, ModelResponse } from "@/lib/types";
import { createId } from "@/lib/utils";
import { callAnthropic } from "./anthropic";
import { cleanModelOutput } from "./clean-output";
import { ModelAdapterError, toFriendlyError } from "./errors";
import { callOpenAICompatible } from "./openai-compatible";

export async function callModel(input: ModelInput): Promise<ModelResponse> {
  const cleanResponse = (response: ModelResponse): ModelResponse => ({
    ...response,
    content: cleanModelOutput(response.content)
  });

  if (typeof window !== "undefined" && window.roundtableDesktop) {
    if (input.signal?.aborted) {
      throw new DOMException("讨论已停止。", "AbortError");
    }

    const requestId = createId("model-call");
    const onAbort = () => {
      void window.roundtableDesktop?.cancelModelCall(requestId);
    };

    input.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const { signal: _signal, ...serializableInput } = input;
      const response = await window.roundtableDesktop.callModel({
        ...serializableInput,
        requestId
      });
      return cleanResponse(response);
    } catch (error) {
      const maybeError = error as Error & { friendlyMessage?: string; status?: number };
      throw new ModelAdapterError(maybeError.friendlyMessage || toFriendlyError(maybeError) || "请求失败，请稍后再试。", {
        status: maybeError.status,
        detail: maybeError.message
      });
    } finally {
      input.signal?.removeEventListener("abort", onAbort);
    }
  }

  if (typeof window !== "undefined") {
    const { signal: _signal, ...serializableInput } = input;
    const response = await fetch("/api/model", {
      method: "POST",
      signal: input.signal,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(serializableInput)
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      if (!payload && response.status === 404) {
        throw new ModelAdapterError("线上模型接口未部署成功：/api/model 返回 404。请重新部署 Vercel，并确认构建时没有使用静态导出模式。", {
          status: response.status,
          detail: "Vercel API route /api/model not found"
        });
      }

      throw new ModelAdapterError(payload?.friendlyMessage || payload?.message || "模型连接失败，请检查配置后重试。", {
        status: typeof payload?.status === "number" ? payload.status : response.status,
        detail: payload?.message
      });
    }

    if (!payload?.content) {
      throw new ModelAdapterError("返回格式不符合预期，没有找到模型回复内容。");
    }

    return cleanResponse(payload as ModelResponse);
  }

  if (input.provider.protocol === "anthropic") {
    return cleanResponse(await callAnthropic(input));
  }

  return cleanResponse(await callOpenAICompatible(input));
}

export { buildConnectionTestReport, toFriendlyError } from "./errors";
