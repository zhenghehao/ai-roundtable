const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const pendingRequests = new Map();
const REQUEST_TIMEOUT_MS = 300_000;
const MAX_MODEL_RETRIES = 4;
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const LOCAL_AGENT_TIMEOUT_MS = 300_000;
const LOCAL_MODEL_DISCOVERY_TIMEOUT_MS = 20_000;
const MAX_LOCAL_OUTPUT_BYTES = 4 * 1024 * 1024;
const LOCAL_SERVICE_DISCOVERY_TIMEOUT_MS = 2500;
const MAX_KNOWLEDGE_FILES = 5000;
const MAX_KNOWLEDGE_FILE_BYTES = 768 * 1024;
const KNOWLEDGE_EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".obsidian",
  ".trash",
  ".stfolder",
  "node_modules",
  "__MACOSX"
]);

function localExecutableSearchPaths() {
  const home = os.homedir();
  const candidates = [
    ...(process.env.PATH || "").split(path.delimiter),
    path.join(home, ".local", "bin"),
    path.join(home, ".npm-global", "bin"),
    path.join(home, ".volta", "bin"),
    path.join(home, ".bun", "bin"),
    path.join(home, ".cargo", "bin"),
    path.join(home, ".asdf", "shims"),
    path.join(home, ".mise", "shims"),
    path.join(home, ".local", "share", "pnpm"),
    path.join(home, "Library", "pnpm"),
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
  const nvmNodeRoot = path.join(home, ".nvm", "versions", "node");
  const fnmNodeRoot = path.join(home, ".local", "share", "fnm", "node-versions");

  try {
    for (const version of fs.readdirSync(workbuddyNodeRoot)) {
      candidates.push(path.join(workbuddyNodeRoot, version, "bin"));
    }
  } catch {
    // WorkBuddy is optional.
  }

  try {
    for (const version of fs.readdirSync(nvmNodeRoot)) {
      candidates.push(path.join(nvmNodeRoot, version, "bin"));
    }
  } catch {
    // nvm is optional.
  }

  try {
    for (const version of fs.readdirSync(fnmNodeRoot)) {
      candidates.push(path.join(fnmNodeRoot, version, "installation", "bin"));
    }
  } catch {
    // fnm is optional.
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

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function normalizeOllamaBaseUrl(value) {
  const baseUrl = trimTrailingSlash(String(value || "").trim() || "http://127.0.0.1:11434");
  return baseUrl.endsWith("/v1") ? baseUrl.slice(0, -3) : baseUrl;
}

function normalizeOpenAIServiceBaseUrl(value, fallback = "http://127.0.0.1:1234/v1") {
  const baseUrl = trimTrailingSlash(String(value || "").trim() || fallback);
  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = LOCAL_SERVICE_DISCOVERY_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, payload };
  } finally {
    clearTimeout(timeout);
  }
}

function firstAvailableExecutable(commandCandidates) {
  for (const command of commandCandidates || []) {
    const executablePath = findExecutable(command);
    if (executablePath) {
      return { command, path: executablePath };
    }
  }

  return undefined;
}

async function detectLocalAgent(request) {
  const configured = hasDetectionMarker(request.detectionPaths);
  const executable = firstAvailableExecutable(request.commandCandidates);

  if (request.agentId === "ollama") {
    const baseUrl = normalizeOllamaBaseUrl(request.baseUrl);

    try {
      const result = await fetchJsonWithTimeout(`${baseUrl}/api/version`);
      if (result.ok) {
        return {
          id: request.id,
          installed: true,
          configured: true,
          command: executable?.command,
          path: executable?.path || baseUrl,
          message: "Ollama 本地服务已启动"
        };
      }
    } catch {
      // Fall back to executable and app marker detection.
    }

    return {
      id: request.id,
      installed: Boolean(executable),
      configured: configured || Boolean(executable),
      command: executable?.command,
      path: executable?.path,
      message: executable ? "已检测到 Ollama，模型服务可能尚未启动" : "未检测到 Ollama 命令"
    };
  }

  if (request.agentId === "lmstudio") {
    const baseUrl = normalizeOpenAIServiceBaseUrl(request.baseUrl);

    try {
      const result = await fetchJsonWithTimeout(`${baseUrl}/models`);
      if (result.ok) {
        return {
          id: request.id,
          installed: true,
          configured: true,
          command: executable?.command,
          path: baseUrl,
          message: "LM Studio 本地服务已启动"
        };
      }
    } catch {
      // Fall back to executable and app marker detection.
    }

    return {
      id: request.id,
      installed: Boolean(executable),
      configured,
      command: executable?.command,
      path: executable?.path,
      message: executable || configured ? "已检测到 LM Studio，OpenAI 兼容服务可能尚未启动" : "未检测到 LM Studio"
    };
  }

  if (executable) {
    return {
      id: request.id,
      installed: true,
      configured,
      command: executable.command,
      path: executable.path
    };
  }

  return {
    id: request.id,
    installed: false,
    configured
  };
}

function uniqueModelOptions(values) {
  const seen = new Set();
  const options = [];

  for (const value of values || []) {
    const id = typeof value === "string" ? value.trim() : String(value?.id || "").trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    options.push({
      id,
      label: typeof value === "object" && value?.label ? String(value.label) : undefined
    });
  }

  return options;
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return undefined;
  }
}

function collectConfiguredModels(value, results = []) {
  if (!value || typeof value !== "object") {
    return results;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectConfiguredModels(item, results));
    return results;
  }

  for (const [key, child] of Object.entries(value)) {
    if (/^(model|modelName|defaultModel|default_model)$/i.test(key) && typeof child === "string") {
      results.push(child);
    } else if (child && typeof child === "object") {
      collectConfiguredModels(child, results);
    }
  }

  return results;
}

function parseModelPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { models: [] };
  }

  const rawModels = Array.isArray(payload.models)
    ? payload.models
    : Array.isArray(payload.data)
      ? payload.data
      : [];
  const models = rawModels.map((item) => {
    if (typeof item === "string") {
      return item;
    }
    const id = item?.model_id || item?.modelId || item?.id || item?.slug || item?.model_name || item?.name;
    const label = item?.display_name || item?.displayName || item?.model_name || item?.name;
    return id ? { id: String(id), label: label ? String(label) : undefined } : undefined;
  }).filter(Boolean);

  return {
    models: uniqueModelOptions(models),
    defaultModel: String(payload.default_model || payload.defaultModel || "").trim() || undefined,
    currentModel: String(payload.current_model || payload.currentModel || "").trim() || undefined
  };
}

function parseOllamaListOutput(stdout) {
  return String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line, index) => line && index > 0)
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean);
}

async function readOllamaModelCatalog(request, executablePath) {
  const baseUrl = normalizeOllamaBaseUrl(request.baseUrl);

  try {
    const result = await fetchJsonWithTimeout(`${baseUrl}/api/tags`);
    const models = Array.isArray(result.payload?.models)
      ? result.payload.models.map((model) => ({
          id: String(model?.name || model?.model || "").trim(),
          label: String(model?.name || model?.model || "").trim() || undefined
        }))
      : [];

    if (result.ok && models.length > 0) {
      return {
        id: request.id,
        models: uniqueModelOptions([request.configuredModel, ...models]),
        currentModel: request.configuredModel || undefined,
        source: "server",
        supportsSelection: true,
        message: "来自 Ollama 本地服务的已下载模型"
      };
    }
  } catch {
    // Fall back to ollama list.
  }

  if (executablePath) {
    try {
      const stdout = await runLocalDiscoveryProcess(executablePath, ["list"]);
      const models = parseOllamaListOutput(stdout);
      if (models.length > 0) {
        return {
          id: request.id,
          models: uniqueModelOptions([request.configuredModel, ...models]),
          currentModel: request.configuredModel || undefined,
          source: "cli",
          supportsSelection: true,
          message: "来自 ollama list 的已下载模型"
        };
      }
    } catch {
      // Report a friendly fallback below.
    }
  }

  return {
    id: request.id,
    models: uniqueModelOptions([request.configuredModel]),
    source: request.configuredModel ? "configured" : "unavailable",
    supportsSelection: true,
    message: executablePath ? "Ollama 模型列表读取失败，请确认服务已启动" : "未检测到 Ollama，暂时无法读取模型"
  };
}

async function readOpenAIServiceModelCatalog(request) {
  const baseUrl = normalizeOpenAIServiceBaseUrl(request.baseUrl);

  try {
    const result = await fetchJsonWithTimeout(`${baseUrl}/models`);
    const parsed = parseModelPayload(result.payload);

    if (result.ok && parsed.models.length > 0) {
      return {
        id: request.id,
        ...parsed,
        models: uniqueModelOptions([request.configuredModel, ...parsed.models]),
        currentModel: request.configuredModel || parsed.currentModel,
        source: "server",
        supportsSelection: true,
        message: "来自本地 OpenAI 兼容服务的模型列表"
      };
    }
  } catch {
    // The local service may not be running.
  }

  return {
    id: request.id,
    models: uniqueModelOptions([request.configuredModel]),
    source: request.configuredModel ? "configured" : "unavailable",
    supportsSelection: true,
    message: "本地模型服务未启动或未返回模型列表"
  };
}

function runLocalDiscoveryProcess(command, args) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(command, args, {
      cwd: localAgentWorkingDirectory(),
      env: localChildEnvironment(command),
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const finish = (callback) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      finish(() => reject(new Error("模型列表读取超时")));
    }, LOCAL_MODEL_DISCOVERY_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (Buffer.byteLength(stdout) > MAX_LOCAL_OUTPUT_BYTES) {
        child.kill("SIGTERM");
        finish(() => reject(new Error("模型列表输出过大")));
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (Buffer.byteLength(stderr) > MAX_LOCAL_OUTPUT_BYTES) {
        stderr = stderr.slice(-MAX_LOCAL_OUTPUT_BYTES);
      }
    });
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code) => {
      finish(() => {
        if (code !== 0) {
          reject(new Error(stderr.trim() || stdout.trim() || `退出码 ${code}`));
          return;
        }
        resolve(stdout);
      });
    });
  });
}

function readCodexModelCatalog(request) {
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  const config = (() => {
    try {
      return fs.readFileSync(path.join(codexHome, "config.toml"), "utf8");
    } catch {
      return "";
    }
  })();
  const currentModel = config.match(/^\s*model\s*=\s*["']([^"']+)["']/m)?.[1];
  const cache = readJsonFile(path.join(codexHome, "models_cache.json"));
  const models = Array.isArray(cache?.models)
    ? cache.models
        .filter((model) => model?.visibility !== "hide")
        .map((model) => ({
          id: String(model?.slug || model?.id || "").trim(),
          label: String(model?.display_name || model?.displayName || "").trim() || undefined
        }))
    : [];

  return {
    id: request.id,
    models: uniqueModelOptions([request.configuredModel, currentModel, ...models]),
    currentModel: currentModel || undefined,
    source: models.length > 0 ? "cache" : currentModel ? "config" : request.configuredModel ? "configured" : "unavailable",
    supportsSelection: true,
    message: models.length > 0 ? "来自 Codex 本机模型缓存" : "Codex 未提供可读模型缓存"
  };
}

function readJsonConfiguredCatalog(request, directories, fallbackModels = []) {
  const configuredModels = [];
  for (const filePath of directories) {
    collectConfiguredModels(readJsonFile(filePath), configuredModels);
  }
  const models = uniqueModelOptions([request.configuredModel, ...configuredModels, ...fallbackModels]);

  return {
    id: request.id,
    models,
    currentModel: configuredModels[0] || undefined,
    source: configuredModels.length > 0
      ? "config"
      : fallbackModels.length > 0
        ? "built-in"
        : request.configuredModel
          ? "configured"
          : "unavailable",
    supportsSelection: true,
    message: configuredModels.length > 0
      ? "来自 CLI 本机配置"
      : fallbackModels.length > 0
        ? "来自 CLI 支持的稳定模型别名"
        : "该 CLI 未提供可枚举的模型列表，可手动输入模型名"
  };
}

function readConfiguredModelsFromFiles(directories) {
  const configuredModels = [];
  for (const filePath of directories) {
    collectConfiguredModels(readJsonFile(filePath), configuredModels);
  }
  return configuredModels;
}

function readGeminiModelCatalog(request, executablePath) {
  const settingsFiles = [
    path.join(os.homedir(), ".gemini", "settings.json"),
    path.join(os.homedir(), ".config", "gemini", "settings.json")
  ];
  const configuredModels = readConfiguredModelsFromFiles(settingsFiles);
  const packageModels = [];

  try {
    const resolvedExecutable = fs.realpathSync(executablePath);
    const bundleDirectory = path.dirname(resolvedExecutable);
    const files = fs
      .readdirSync(bundleDirectory)
      .filter((fileName) => fileName.endsWith(".js"))
      .sort();

    for (const fileName of files) {
      const filePath = path.join(bundleDirectory, fileName);
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || stat.size > 40 * 1024 * 1024) {
        continue;
      }

      const source = fs.readFileSync(filePath, "utf8");
      if (!source.includes("DEFAULT_GEMINI_MODEL")) {
        continue;
      }

      const namedModels = new Map();
      for (const match of source.matchAll(
        /var\s+((?:PREVIEW|DEFAULT)_GEMINI[A-Z0-9_]*_MODEL)\s*=\s*"([^"]+)"/g
      )) {
        namedModels.set(match[1], match[2]);
      }
      const preferredOrder = [
        "DEFAULT_GEMINI_MODEL",
        "PREVIEW_GEMINI_3_1_MODEL",
        "PREVIEW_GEMINI_MODEL",
        "PREVIEW_GEMINI_FLASH_MODEL",
        "DEFAULT_GEMINI_3_5_FLASH_MODEL",
        "DEFAULT_GEMINI_FLASH_MODEL",
        "DEFAULT_GEMINI_FLASH_LITE_MODEL"
      ];
      for (const key of preferredOrder) {
        if (namedModels.has(key)) {
          packageModels.push(namedModels.get(key));
        }
      }
      break;
    }
  } catch {
    // Fall back to configured or manually entered models.
  }

  const models = uniqueModelOptions([request.configuredModel, ...configuredModels, ...packageModels]);
  return {
    id: request.id,
    models,
    currentModel: configuredModels[0] || undefined,
    defaultModel: packageModels[0] || undefined,
    source: packageModels.length > 0
      ? "package"
      : configuredModels.length > 0
        ? "config"
        : request.configuredModel
          ? "configured"
          : "unavailable",
    supportsSelection: true,
    message: packageModels.length > 0
      ? "来自本机已安装 Gemini CLI 的模型定义"
      : "Gemini CLI 未暴露模型列表，可手动输入模型名"
  };
}

function readHermesModelCatalog(request) {
  const configPath = path.join(os.homedir(), ".hermes", "config.yaml");
  let config = "";
  try {
    config = fs.readFileSync(configPath, "utf8");
  } catch {
    // Hermes can still accept an explicitly configured model.
  }

  const currentModel = config.match(/^model:\s*\n(?:^[ \t].*\n)*?^[ \t]+default:\s*["']?([^"'#\n]+)["']?/m)?.[1]?.trim();
  const currentProvider = config.match(/^model:\s*\n(?:^[ \t].*\n)*?^[ \t]+provider:\s*["']?([^"'#\n]+)["']?/m)?.[1]?.trim();
  const providerModels = [];

  if (currentProvider) {
    const providerPattern = new RegExp(`^  ${currentProvider.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}:\\s*\\n([\\s\\S]*?)(?=^  [^\\s][^:]*:\\s*$|^\\S|(?![\\s\\S]))`, "m");
    const providerBlock = config.match(providerPattern)?.[1] || "";
    const modelsBlock = providerBlock.match(/^    models:\s*\n([\s\S]*?)(?=^    [^\s-][^:]*:\s*|^  \S|(?![\s\S]))/m)?.[1] || "";
    for (const match of modelsBlock.matchAll(/^    -\s*["']?([^"'#\n]+)["']?/gm)) {
      providerModels.push(match[1].trim());
    }
  }

  return {
    id: request.id,
    models: uniqueModelOptions([request.configuredModel, currentModel, ...providerModels]),
    currentModel: currentModel || undefined,
    source: config ? "config" : request.configuredModel ? "configured" : "unavailable",
    supportsSelection: true,
    message: config ? "来自 Hermes 当前供应商配置" : "Hermes 配置中未找到模型列表"
  };
}

async function discoverLocalAgentModels(request) {
  const executablePath = (request.commandCandidates || []).map(findExecutable).find(Boolean);

  if (request.agentId === "ollama") {
    return readOllamaModelCatalog(request, executablePath);
  }

  if (request.agentId === "lmstudio") {
    return readOpenAIServiceModelCatalog(request);
  }

  if (!executablePath) {
    return {
      id: request.id,
      models: uniqueModelOptions([request.configuredModel]),
      source: request.configuredModel ? "configured" : "unavailable",
      supportsSelection: false,
      message: "CLI 未安装，暂时无法读取模型"
    };
  }

  if (request.agentId === "codex") {
    return readCodexModelCatalog(request);
  }

  if (request.agentId === "kiro") {
    try {
      const stdout = await runLocalDiscoveryProcess(executablePath, ["chat", "--list-models", "--format", "json"]);
      const parsed = parseModelPayload(JSON.parse(stdout));
      return {
        id: request.id,
        ...parsed,
        models: uniqueModelOptions([request.configuredModel, parsed.currentModel, parsed.defaultModel, ...parsed.models]),
        source: "cli",
        supportsSelection: true,
        message: "由 Kiro CLI 返回当前账号可用模型"
      };
    } catch {
      return {
        id: request.id,
        models: uniqueModelOptions([request.configuredModel]),
        source: request.configuredModel ? "configured" : "unavailable",
        supportsSelection: true,
        message: "Kiro 模型列表读取失败，可手动输入模型名"
      };
    }
  }

  if (request.agentId === "openclaw") {
    try {
      const stdout = await runLocalDiscoveryProcess(executablePath, ["models", "list", "--json"]);
      const parsed = parseModelPayload(JSON.parse(stdout));
      return {
        id: request.id,
        ...parsed,
        models: uniqueModelOptions([request.configuredModel, parsed.currentModel, parsed.defaultModel, ...parsed.models]),
        source: "cli",
        supportsSelection: true,
        message: "由 OpenClaw 返回已配置模型"
      };
    } catch {
      return {
        id: request.id,
        models: uniqueModelOptions([request.configuredModel]),
        source: request.configuredModel ? "configured" : "unavailable",
        supportsSelection: true,
        message: "OpenClaw 模型列表读取失败，可手动输入模型名"
      };
    }
  }

  if (request.agentId === "hermes") {
    return readHermesModelCatalog(request);
  }

  if (request.agentId === "claude") {
    return readJsonConfiguredCatalog(
      request,
      [
        path.join(os.homedir(), ".claude", "settings.json"),
        path.join(os.homedir(), ".claude.json")
      ],
      ["sonnet", "opus", "haiku"]
    );
  }

  if (request.agentId === "gemini") {
    return readGeminiModelCatalog(request, executablePath);
  }

  if (request.agentId === "codebuddy") {
    return readJsonConfiguredCatalog(
      request,
      [
        path.join(os.homedir(), ".codebuddy", "settings.json"),
        path.join(os.homedir(), ".config", "codebuddy", "settings.json")
      ]
    );
  }

  return {
    id: request.id,
    models: uniqueModelOptions([request.configuredModel]),
    source: request.configuredModel ? "configured" : "unavailable",
    supportsSelection: (request.args || []).some((argument) => String(argument).includes("{model}")),
    message: "自定义 CLI 仅展示已配置模型；可在命令参数中使用 {model}"
  };
}

function isMarkdownKnowledgeFile(filePath) {
  return /\.(md|markdown)$/i.test(filePath);
}

function resolveKnowledgeVaultPath(vaultPath) {
  const resolved = resolveDetectionPath(vaultPath);
  if (!resolved) {
    throw createFriendlyError("请先选择 Obsidian 知识库文件夹。");
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw createFriendlyError("选择的知识库路径不是文件夹。");
  }

  return resolved;
}

function collectKnowledgeFiles(rootPath) {
  const files = [];
  const stack = [rootPath];

  while (stack.length > 0 && files.length < MAX_KNOWLEDGE_FILES) {
    const current = stack.pop();
    let entries = [];

    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }

      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!KNOWLEDGE_EXCLUDED_DIRECTORIES.has(entry.name)) {
          stack.push(filePath);
        }
        continue;
      }

      if (entry.isFile() && isMarkdownKnowledgeFile(entry.name)) {
        files.push(filePath);
        if (files.length >= MAX_KNOWLEDGE_FILES) {
          break;
        }
      }
    }
  }

  return files;
}

function tokenizeKnowledgeQuery(query) {
  const text = String(query || "").toLowerCase();
  const terms = new Set();
  for (const match of text.matchAll(/[\p{Script=Han}]{2,}|[a-z0-9_+#.-]{2,}/gu)) {
    const term = match[0];
    terms.add(term);
    if (/^[\p{Script=Han}]+$/u.test(term) && term.length > 3) {
      for (let index = 0; index < Math.min(term.length - 1, 18); index += 1) {
        terms.add(term.slice(index, index + 2));
      }
    }
  }
  return Array.from(terms).slice(0, 48);
}

function stripObsidianSyntax(markdown) {
  return String(markdown || "")
    .replace(/^---[\s\S]*?---\s*/m, "")
    .replace(/!\[\[[^\]]+\]\]/g, "")
    .replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_match, target, label) => label || target)
    .replace(/`{3}[\s\S]*?`{3}/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[#>*_~]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function scoreKnowledgeFile({ title, content, terms, rawQuery }) {
  const haystack = content.toLowerCase();
  const titleHaystack = title.toLowerCase();
  let score = 0;

  if (rawQuery && titleHaystack.includes(rawQuery)) {
    score += 18;
  }
  if (rawQuery && haystack.includes(rawQuery)) {
    score += 8;
  }

  for (const term of terms) {
    if (titleHaystack.includes(term)) {
      score += 6;
    }
    const matches = haystack.split(term).length - 1;
    if (matches > 0) {
      score += Math.min(8, matches) * 1.5;
    }
  }

  return score;
}

function makeKnowledgeExcerpt(content, terms, maxChars) {
  const lower = content.toLowerCase();
  let index = -1;

  for (const term of terms) {
    index = lower.indexOf(term);
    if (index >= 0) {
      break;
    }
  }

  const start = index < 0 ? 0 : Math.max(0, index - Math.floor(maxChars * 0.28));
  const excerpt = content.slice(start, start + maxChars).trim();
  const prefix = start > 0 ? "..." : "";
  const suffix = start + maxChars < content.length ? "\n..." : "";
  return `${prefix}${excerpt}${suffix}`;
}

function searchKnowledgeBase(request) {
  const vaultPath = resolveKnowledgeVaultPath(request.vaultPath);
  const query = String(request.query || "").trim();
  const terms = tokenizeKnowledgeQuery(query || path.basename(vaultPath));
  const rawQuery = query.toLowerCase();
  const limit = Math.min(12, Math.max(1, Number(request.limit || 5)));
  const maxCharsPerNote = Math.min(8000, Math.max(600, Number(request.maxCharsPerNote || 2400)));
  const files = collectKnowledgeFiles(vaultPath);
  const hits = [];

  for (const filePath of files) {
    let stat;
    try {
      stat = fs.statSync(filePath);
      if (stat.size > MAX_KNOWLEDGE_FILE_BYTES) {
        continue;
      }
    } catch {
      continue;
    }

    let source = "";
    try {
      source = fs.readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    const title = path.basename(filePath).replace(/\.(md|markdown)$/i, "");
    const content = stripObsidianSyntax(source);
    const score = scoreKnowledgeFile({ title, content, terms, rawQuery });
    if (score <= 0) {
      continue;
    }

    hits.push({
      title,
      relativePath: path.relative(vaultPath, filePath),
      score,
      excerpt: makeKnowledgeExcerpt(content, terms, maxCharsPerNote),
      modifiedAt: stat.mtime.toISOString()
    });
  }

  hits.sort((a, b) => b.score - a.score || a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true }));

  return {
    vaultPath,
    query,
    hits: hits.slice(0, limit),
    scannedFileCount: files.length,
    message:
      files.length >= MAX_KNOWLEDGE_FILES
        ? `已扫描前 ${MAX_KNOWLEDGE_FILES} 个 Markdown 文件`
        : `已扫描 ${files.length} 个 Markdown 文件`
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
      args: [
        "chat",
        "--no-interactive",
        "--trust-tools=read,grep",
        ...(model ? ["--model", model] : []),
        prompt
      ]
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
        "Read,Grep",
        ...(model ? ["--model", model] : [])
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

function isLocalBaseUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    return ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}

async function callOpenAICompatible(input, signal) {
  const apiKey = input.provider.apiKey.trim();
  const baseUrl = trimTrailingSlash(input.provider.baseUrl.trim());
  const model = (input.model || input.provider.defaultModel).trim();

  if (!baseUrl) {
    throw createFriendlyError("请先填写 Base URL。");
  }

  if (!apiKey && !isLocalBaseUrl(baseUrl)) {
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
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
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

async function callOllama(input, signal) {
  const baseUrl = normalizeOllamaBaseUrl(input.provider.baseUrl);
  const model = (input.model || input.provider.defaultModel).trim();

  if (!model) {
    throw createFriendlyError("请先在模型配置中选择一个 Ollama 已下载模型。");
  }

  return withModelRequestRetries(async (attemptSignal) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      signal: attemptSignal,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: input.systemPrompt },
          ...(input.messages || []).map((message) => ({
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
      throw createFriendlyError(
        detail ? `Ollama 调用失败：${detail}` : "Ollama 调用失败，请确认本地服务已启动且模型已下载。",
        detail,
        response.status,
        getRetryAfterMs(response)
      );
    }

    const content = String(payload?.message?.content || payload?.response || "").trim();
    if (!content) {
      throw createFriendlyError("Ollama 已返回，但没有找到可识别的回复内容。");
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

  if (input.provider.protocol === "ollama") {
    return callOllama(input, signal);
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

ipcMain.handle("local-agents:detect", async (_event, requests) => {
  if (!Array.isArray(requests)) {
    return [];
  }

  return Promise.all(
    requests
      .filter((request) => request && typeof request.id === "string" && Array.isArray(request.commandCandidates))
      .map(detectLocalAgent)
  );
});

ipcMain.handle("local-agents:models", async (_event, requests) => {
  if (!Array.isArray(requests)) {
    return [];
  }

  return Promise.all(
    requests
      .filter(
        (request) =>
          request &&
          typeof request.id === "string" &&
          typeof request.agentId === "string" &&
          Array.isArray(request.commandCandidates)
      )
      .map(discoverLocalAgentModels)
  );
});

ipcMain.handle("knowledge:select-vault", async (event) => {
  const owner = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(owner || undefined, {
    title: "选择 Obsidian 知识库文件夹",
    properties: ["openDirectory", "createDirectory"]
  });

  return result.canceled ? undefined : result.filePaths[0];
});

ipcMain.handle("knowledge:search", (_event, request) => {
  if (!request || typeof request.vaultPath !== "string") {
    return {
      vaultPath: "",
      query: "",
      hits: [],
      scannedFileCount: 0,
      message: "请先选择 Obsidian 知识库文件夹"
    };
  }

  return searchKnowledgeBase(request);
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
