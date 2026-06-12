const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const pendingRequests = new Map();
const REQUEST_TIMEOUT_MS = 300_000;
const MAX_MODEL_RETRIES = 4;
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const LOCAL_AGENT_TIMEOUT_MS = 300_000;
const MAX_LOCAL_OUTPUT_BYTES = 4 * 1024 * 1024;

function localExecutableSearchPaths() {
  const home = os.homedir();
  const candidates = [
    ...(process.env.PATH || "").split(path.delimiter),
    path.join(home, ".local", "bin"),
    path.join(home, ".npm-global", "bin"),
    path.join(home, ".volta", "bin"),
    path.join(home, ".bun", "bin"),
    path.join(home, ".cargo", "bin"),
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/local/sbin",
    "/usr/bin",
    "/usr/sbin",
    "/sbin",
    "/bin"
  ];
  const workbuddyNodeRoot = path.join(home, ".workbuddy", "binaries", "node", "versions");

  try {
    for (const version of fs.readdirSync(workbuddyNodeRoot)) {
      candidates.push(path.join(workbuddyNodeRoot, version, "bin"));
    }
  } catch {
    // WorkBuddy is optional.
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function executableFileNames(command) {
  if (process.platform !== "win32") {
    return [command];
  }

  const extension = path.extname(command);
  return extension ? [command] : [command, `${command}.exe`, `${command}.cmd`, `${command}.bat`];
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, process.platform === "win32" ? fs.constants.F_OK : fs.constants.X_OK);
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function findExecutable(command) {
  const value = String(command || "").trim();
  if (!value) {
    return undefined;
  }

  if (path.isAbsolute(value) || value.includes("/") || value.includes("\\")) {
    const resolved = path.resolve(value);
    return isExecutable(resolved) ? resolved : undefined;
  }

  for (const directory of localExecutableSearchPaths()) {
    for (const fileName of executableFileNames(value)) {
      const candidate = path.join(directory, fileName);
      if (isExecutable(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}

function resolveDetectionPath(value) {
  const candidate = String(value || "").trim();
  if (!candidate) {
    return undefined;
  }

  if (candidate === "~") {
    return os.homedir();
  }

  if (candidate.startsWith("~/") || candidate.startsWith(`~${path.sep}`)) {
    return path.join(os.homedir(), candidate.slice(2));
  }

  return path.resolve(candidate);
}

function hasDetectionMarker(detectionPaths) {
  return (detectionPaths || []).some((detectionPath) => {
    const resolved = resolveDetectionPath(detectionPath);
    return Boolean(resolved && fs.existsSync(resolved));
  });
}

function detectLocalAgent(request) {
  const configured = hasDetectionMarker(request.detectionPaths);

  for (const command of request.commandCandidates || []) {
    const executablePath = findExecutable(command);
    if (executablePath) {
      return {
        id: request.id,
        installed: true,
        configured,
        command,
        path: executablePath
      };
    }
  }

  return {
    id: request.id,
    installed: false,
    configured
  };
}

function localAgentWorkingDirectory() {
  const directory = path.join(app.getPath("userData"), "agent-workspace");
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function buildLocalAgentPrompt(input) {
  const transcript = (input.messages || [])
    .map((message) => `${message.role === "assistant" ? "圆桌成员" : "用户"}：${message.content}`)
    .join("\n\n");

  return [
    "【圆桌角色规则】",
    input.systemPrompt || "",
    "",
    "【圆桌共享上下文】",
    transcript || "暂无历史消息。",
    "",
    "请直接给出本轮回复。不要描述你正在使用哪个 CLI，也不要输出内部思考过程。"
  ].join("\n");
}

function getValueAtPath(value, dottedPath) {
  if (!dottedPath) {
    return undefined;
  }

  return dottedPath.split(".").reduce((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return current[key];
  }, value);
}

function extractTextFromJson(value, preferredPath) {
  const preferred = getValueAtPath(value, preferredPath);
  if (typeof preferred === "string" && preferred.trim()) {
    return preferred.trim();
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const commonPaths = ["result", "response", "content", "output", "text", "message.content"];
  for (const candidatePath of commonPaths) {
    const candidate = getValueAtPath(value, candidatePath);
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => extractTextFromJson(item, preferredPath)).filter(Boolean).join("\n").trim();
  }

  for (const child of Object.values(value)) {
    const candidate = extractTextFromJson(child, preferredPath);
    if (candidate) {
      return candidate;
    }
  }

  return "";
}

function parseLocalAgentOutput(stdout, outputFormat, resultPath) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return "";
  }

  if (outputFormat === "text") {
    return trimmed;
  }

  if (outputFormat === "json") {
    try {
      return extractTextFromJson(JSON.parse(trimmed), resultPath);
    } catch {
      // Some CLIs write progress before the final JSON object.
    }
  }

  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const content = extractTextFromJson(JSON.parse(lines[index]), resultPath);
      if (content) {
        return content;
      }
    } catch {
      // Ignore non-JSON progress lines.
    }
  }

  return trimmed;
}

function replaceArgumentPlaceholders(value, input, prompt) {
  return String(value)
    .replaceAll("{prompt}", prompt)
    .replaceAll("{systemPrompt}", input.systemPrompt || "")
    .replaceAll("{model}", input.model || input.provider.defaultModel || "")
    .replaceAll("{cwd}", localAgentWorkingDirectory());
}

function buildLocalInvocation(input, prompt, executablePath) {
  const config = input.provider.localCli;
  const model = String(input.model || input.provider.defaultModel || "").trim();
  const agentId = config.agentId;

  if (agentId === "codex") {
    const outputFile = path.join(os.tmpdir(), `ai-roundtable-codex-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
    return {
      command: executablePath,
      args: [
        "exec",
        "--sandbox",
        "read-only",
        "--ephemeral",
        "--skip-git-repo-check",
        "--color",
        "never",
        ...(model ? ["--model", model] : []),
        "--output-last-message",
        outputFile,
        "-"
      ],
      stdin: prompt,
      outputFile
    };
  }

  if (agentId === "claude") {
    return {
      command: executablePath,
      args: [
        "-p",
        "--output-format",
        "json",
        "--permission-mode",
        "plan",
        "--tools",
        "",
        "--no-session-persistence",
        ...(model ? ["--model", model] : [])
      ],
      stdin: prompt
    };
  }

  if (agentId === "gemini") {
    return {
      command: executablePath,
      args: [
        "--prompt",
        "",
        "--output-format",
        "json",
        "--approval-mode",
        "plan",
        ...(model ? ["--model", model] : [])
      ],
      stdin: prompt
    };
  }

  if (agentId === "kiro") {
    return {
      command: executablePath,
      args: ["chat", "--no-interactive", "--trust-tools=read,grep", prompt]
    };
  }

  if (agentId === "codebuddy") {
    return {
      command: executablePath,
      args: [
        "-p",
        "--output-format",
        "json",
        "--permission-mode",
        "plan",
        "--allowedTools",
        "Read,Grep"
      ],
      stdin: prompt
    };
  }

  if (agentId === "hermes") {
    return {
      command: executablePath,
      args: [
        "--oneshot",
        prompt,
        "--toolsets",
        "vision",
        "--ignore-rules",
        ...(model ? ["--model", model] : [])
      ]
    };
  }

  if (agentId === "openclaw") {
    return {
      command: executablePath,
      args: [
        "infer",
        "model",
        "run",
        "--prompt",
        prompt,
        "--thinking",
        "low",
        ...(model ? ["--model", model] : []),
        "--json"
      ]
    };
  }

  const configuredArgs = (config.args || []).map((argument) => replaceArgumentPlaceholders(argument, input, prompt));
  const hasPromptPlaceholder = (config.args || []).some((argument) => argument.includes("{prompt}"));
  return {
    command: executablePath,
    args: config.inputMode === "argument" && !hasPromptPlaceholder ? [...configuredArgs, prompt] : configuredArgs,
    stdin: config.inputMode === "stdin" ? prompt : undefined
  };
}

function localChildEnvironment(executablePath) {
  const searchPaths = [
    path.dirname(executablePath),
    ...localExecutableSearchPaths()
  ];
  const environment = {
    ...process.env,
    PATH: Array.from(new Set(searchPaths.filter(Boolean))).join(path.delimiter)
  };

  if (process.platform === "win32") {
    environment.Path = environment.PATH;
  }

  return environment;
}

function runLocalProcess(invocation, signal) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(invocation.command, invocation.args, {
      cwd: localAgentWorkingDirectory(),
      env: localChildEnvironment(invocation.command),
      shell: false,
      stdio: ["pipe", "pipe", "pipe"]
    });

    const finish = (callback) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => {
      child.kill("SIGTERM");
      finish(() => reject(createAbortError()));
    };
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      finish(() => reject(createFriendlyError("本地 CLI 响应超时，请检查登录状态或稍后重试。")));
    }, LOCAL_AGENT_TIMEOUT_MS);

    signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (Buffer.byteLength(stdout) > MAX_LOCAL_OUTPUT_BYTES) {
        child.kill("SIGTERM");
        finish(() => reject(createFriendlyError("本地 CLI 输出过大，已停止本次调用。")));
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (Buffer.byteLength(stderr) > MAX_LOCAL_OUTPUT_BYTES) {
        stderr = stderr.slice(-MAX_LOCAL_OUTPUT_BYTES);
      }
    });
    child.on("error", (error) => {
      finish(() => reject(createFriendlyError(`无法启动本地 CLI：${error.message}`)));
    });
    child.on("close", (code) => {
      finish(() => {
        if (code !== 0) {
          const detail = stderr.trim() || stdout.trim() || `退出码 ${code}`;
          reject(createFriendlyError(`本地 CLI 调用失败：${detail.slice(0, 1200)}`, detail));
          return;
        }
        resolve({ stdout, stderr });
      });
    });

    if (invocation.stdin !== undefined) {
      child.stdin.end(invocation.stdin);
    } else {
      child.stdin.end();
    }
  });
}

async function callLocalCli(input, signal) {
  const config = input.provider.localCli;
  if (!config) {
    throw createFriendlyError("本地 CLI 配置不完整。");
  }
  if (config.capability !== "adapted") {
    throw createFriendlyError("该本地智能体目前只支持安装检测，尚未开放圆桌对话适配。");
  }

  const executablePath = (config.commandCandidates || []).map(findExecutable).find(Boolean);
  if (!executablePath) {
    throw createFriendlyError(`未检测到 ${config.commandCandidates?.join(" / ") || input.provider.name}，请先安装并完成登录。`);
  }

  const prompt = buildLocalAgentPrompt(input);
  const invocation = buildLocalInvocation(input, prompt, executablePath);

  try {
    const result = await runLocalProcess(invocation, signal);
    const fileOutput =
      invocation.outputFile && fs.existsSync(invocation.outputFile)
        ? fs.readFileSync(invocation.outputFile, "utf8").trim()
        : "";
    const content =
      fileOutput ||
      parseLocalAgentOutput(
        result.stdout,
        config.outputFormat || "text",
        config.resultPath
      );

    if (!content) {
      throw createFriendlyError("本地 CLI 已运行，但没有返回可识别的回复内容。", result.stderr || result.stdout);
    }

    return {
      content,
      raw: {
        command: executablePath,
        stderr: result.stderr || undefined
      }
    };
  } finally {
    if (invocation.outputFile) {
      try {
        fs.unlinkSync(invocation.outputFile);
      } catch {
        // The CLI may fail before creating the output file.
      }
    }
  }
}

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
  if (input.provider.protocol === "local-cli") {
    return callLocalCli(input, signal);
  }

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
    title: "",
    backgroundColor: "#f3f6f5",
    ...(process.platform === "darwin"
      ? {
          titleBarStyle: "hiddenInset",
          trafficLightPosition: { x: 16, y: 15 }
        }
      : {}),
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

ipcMain.handle("local-agents:detect", (_event, requests) => {
  if (!Array.isArray(requests)) {
    return [];
  }

  return requests
    .filter((request) => request && typeof request.id === "string" && Array.isArray(request.commandCandidates))
    .map(detectLocalAgent);
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
