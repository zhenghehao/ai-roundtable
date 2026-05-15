const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");

const pendingRequests = new Map();

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

  return detail ? `请求失败：${detail}` : "请求失败，请检查模型配置后重试。";
}

function createFriendlyError(message, detail) {
  const error = new Error(detail || message);
  error.friendlyMessage = message;
  return error;
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

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: input.systemPrompt }, ...input.messages],
      temperature: 0.7
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = extractErrorDetail(payload);
    throw createFriendlyError(friendlyMessageFromStatus(response.status, detail), detail);
  }

  const content = normalizeOpenAIContent(payload?.choices);

  if (!content) {
    throw createFriendlyError("返回格式不符合预期，没有找到模型回复内容。");
  }

  return { content, raw: payload };
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

  const response = await fetch(getAnthropicEndpoint(input.provider.baseUrl), {
    method: "POST",
    signal,
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
    throw createFriendlyError(friendlyMessageFromStatus(response.status, detail), detail);
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
    throw createFriendlyError(error?.friendlyMessage || error?.message || "请求失败，请稍后再试。", error?.message);
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
