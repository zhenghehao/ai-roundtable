const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");

const pendingRequests = new Map();
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_MODEL_RETRIES = 4;
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function extractErrorDetail(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  if (payload.error && typeof payload.error === "object") {
    if (typeof payload.error.message === "string") {
      return payload.error.message;
    }
    if (typeof payload.error.type === "string") {
      return payload.error.type;
    }
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return "";
}

function friendlyMessageFromStatus(status, detail) {
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

  return normalizedDetail ? `请求失败：${normalizedDetail}` : "请求失败，请检查模型配置后重试。";
}

function createFriendlyError(message, detail, status, retryAfterMs) {
  const error = new Error(detail || message);
  error.friendlyMessage = message;
  error.status = status;
  error.retryAfterMs = retryAfterMs;
  return error;
}

function createAbortError() {
  const error = new Error("讨论已停止。");
  error.name = "AbortError";
  return error;
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function isRetryableModelError(error) {
  if (typeof error?.status === "number") {
    return RETRYABLE_STATUS.has(error.status);
  }

  return error instanceof TypeError;
}

function retryDelay(attempt, error) {
  if (error?.retryAfterMs) {
    return Math.min(error.retryAfterMs, 60_000);
  }

  const baseDelay = error?.status === 429 ? 5000 : 1800;
  return baseDelay * 2 ** attempt + Math.floor(Math.random() * 600);
}

function createAttemptSignal(parentSignal) {
  const controller = new AbortController();
  let timedOut = false;

  const timeout = setTimeout(() => {
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
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", onAbort);
    }
  };
}

async function waitWithAbort(ms, signal) {
  if (signal?.aborted) {
    throw createAbortError();
  }

  await new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const timer = setTimeout(() => {
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

async function withModelRequestRetries(operation, parentSignal) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_MODEL_RETRIES; attempt += 1) {
    if (parentSignal?.aborted) {
      throw createAbortError();
    }

    const attemptSignal = createAttemptSignal(parentSignal);

    try {
      return await operation(attemptSignal.signal);
    } catch (error) {
      lastError =
        attemptSignal.timedOut && isAbortError(error)
          ? createFriendlyError("请求超时，供应商响应较慢或网络不稳定。请稍后重试。", undefined, 408)
          : error;

      if (parentSignal?.aborted || isAbortError(lastError)) {
        throw createAbortError();
      }

      if (attempt >= MAX_MODEL_RETRIES || !isRetryableModelError(lastError)) {
        throw lastError;
      }

      await waitWithAbort(retryDelay(attempt, lastError), parentSignal);
    } finally {
      attemptSignal.cleanup();
    }
  }

  throw lastError;
}

function getRetryAfterMs(response) {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) {
    return undefined;
  }

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const retryDate = Date.parse(retryAfter);
  return Number.isNaN(retryDate) ? undefined : Math.max(0, retryDate - Date.now());
}

function normalizeOpenAIContent(choices) {
  const content = choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (part.type === "text" || !part.type ? part.text || "" : ""))
      .join("")
      .trim();
  }

  return "";
}

async function callOpenAICompatible(input, signal) {
  const apiKey = input.provider.apiKey.trim();
  const baseUrl = trimTrailingSlash(input.provider.baseUrl.trim());
  const model = (input.model || input.provider.defaultModel).trim();

  if (!baseUrl) {
    throw createFriendlyError("请先填写 Base URL。");
  }

  if (!apiKey) {
    throw createFriendlyError("请先填写 API Key。API Key 只会保存在你的浏览器本地。");
  }

  if (!model) {
    throw createFriendlyError("请先填写模型名。");
  }

  return withModelRequestRetries(async (attemptSignal) => {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: attemptSignal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: input.systemPrompt }, ...input.messages],
        stream: false
      })
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = extractErrorDetail(payload);
      throw createFriendlyError(
        friendlyMessageFromStatus(response.status, detail),
        detail,
        response.status,
        getRetryAfterMs(response)
      );
    }

    const content = normalizeOpenAIContent(payload?.choices);

    if (!content) {
      throw createFriendlyError("返回格式不符合预期，没有找到模型回复内容。");
    }

    return { content, raw: payload };
  }, signal);
}

function getAnthropicEndpoint(baseUrl) {
  const normalized = trimTrailingSlash(baseUrl.trim() || "https://api.anthropic.com");
  return normalized.endsWith("/v1") ? `${normalized}/messages` : `${normalized}/v1/messages`;
}

async function callAnthropic(input, signal) {
  const apiKey = input.provider.apiKey.trim();
  const model = (input.model || input.provider.defaultModel).trim();

  if (!apiKey) {
    throw createFriendlyError("请先填写 API Key。API Key 只会保存在你的浏览器本地。");
  }

  if (!model) {
    throw createFriendlyError("请先填写模型名。");
  }

  return withModelRequestRetries(async (attemptSignal) => {
    const response = await fetch(getAnthropicEndpoint(input.provider.baseUrl), {
      method: "POST",
      signal: attemptSignal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        system: input.systemPrompt,
        max_tokens: 2048,
        messages: input.messages
      })
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = extractErrorDetail(payload);
      throw createFriendlyError(
        friendlyMessageFromStatus(response.status, detail),
        detail,
        response.status,
        getRetryAfterMs(response)
      );
    }

    const content = payload?.content
      ?.filter((part) => part.type === "text" || !part.type)
      .map((part) => part.text || "")
      .join("")
      .trim();

    if (!content) {
      throw createFriendlyError("返回格式不符合预期，没有找到模型回复内容。");
    }

    return { content, raw: payload };
  }, signal);
}

async function callModel(input, signal) {
  if (input.provider.protocol === "anthropic") {
    return callAnthropic(input, signal);
  }

  return callOpenAICompatible(input, signal);
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1080,
    minHeight: 680,
    title: "AI圆桌",
    backgroundColor: "#f6f7f9",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.removeMenu();
  window.loadFile(path.join(__dirname, "..", "out", "index.html"));

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  return window;
}

ipcMain.handle("model:call", async (_event, input) => {
  const controller = new AbortController();
  pendingRequests.set(input.requestId, controller);

  try {
    return await callModel(input, controller.signal);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createFriendlyError("讨论已停止。");
    }
    throw createFriendlyError(
      error?.friendlyMessage || error?.message || "请求失败，请稍后再试。",
      error?.message,
      error?.status,
      error?.retryAfterMs
    );
  } finally {
    pendingRequests.delete(input.requestId);
  }
});

ipcMain.handle("model:cancel", (_event, requestId) => {
  pendingRequests.get(requestId)?.abort();
  pendingRequests.delete(requestId);
  return true;
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
