import { ModelAdapterError } from "./errors";

const REQUEST_TIMEOUT_MS = 300_000;
const MAX_RETRIES = 4;
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function createAbortError() {
  return new DOMException("讨论已停止。", "AbortError");
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isRetryableError(error: unknown) {
  if (error instanceof ModelAdapterError) {
    return typeof error.status === "number" && RETRYABLE_STATUS.has(error.status);
  }

  return error instanceof TypeError;
}

function getRetryDelay(attempt: number, error: unknown) {
  if (error instanceof ModelAdapterError && error.retryAfterMs) {
    return Math.min(error.retryAfterMs, 60_000);
  }

  const baseDelay = error instanceof ModelAdapterError && error.status === 429 ? 5000 : 1800;
  return baseDelay * 2 ** attempt + Math.floor(Math.random() * 600);
}

function wait(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      globalThis.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const timer = globalThis.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(createAbortError());
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function createAttemptSignal(parentSignal?: AbortSignal) {
  const controller = new AbortController();
  let timedOut = false;

  const timeout = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const onAbort = () => controller.abort();
  parentSignal?.addEventListener("abort", onAbort, { once: true });

  return {
    signal: controller.signal,
    get timedOut() {
      return timedOut;
    },
    cleanup() {
      globalThis.clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", onAbort);
    }
  };
}

export async function withModelRequestRetries<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  parentSignal?: AbortSignal
) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    if (parentSignal?.aborted) {
      throw createAbortError();
    }

    const attemptSignal = createAttemptSignal(parentSignal);

    try {
      return await operation(attemptSignal.signal);
    } catch (error) {
      lastError =
        attemptSignal.timedOut && isAbortError(error)
          ? new ModelAdapterError("请求超时，供应商响应较慢或网络不稳定。请稍后重试。", { status: 408 })
          : error;

      if (parentSignal?.aborted || isAbortError(lastError)) {
        throw createAbortError();
      }

      if (attempt >= MAX_RETRIES || !isRetryableError(lastError)) {
        throw lastError;
      }

      await wait(getRetryDelay(attempt, lastError), parentSignal);
    } finally {
      attemptSignal.cleanup();
    }
  }

  throw lastError;
}
