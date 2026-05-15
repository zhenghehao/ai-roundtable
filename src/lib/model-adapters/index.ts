import type { ModelInput, ModelResponse } from "@/lib/types";
import { createId } from "@/lib/utils";
import { callAnthropic } from "./anthropic";
import { cleanModelOutput } from "./clean-output";
import { ModelAdapterError } from "./errors";
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
      const maybeError = error as Error & { friendlyMessage?: string };
      throw new ModelAdapterError(maybeError.friendlyMessage || maybeError.message || "请求失败，请稍后再试。");
    } finally {
      input.signal?.removeEventListener("abort", onAbort);
    }
  }

  if (input.provider.protocol === "anthropic") {
    return cleanResponse(await callAnthropic(input));
  }

  return cleanResponse(await callOpenAICompatible(input));
}

export { toFriendlyError } from "./errors";
