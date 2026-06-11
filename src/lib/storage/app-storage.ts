import { FILE_MASTER_ROLE_ID, createDefaultAppState } from "@/lib/defaults";
import type { Translator } from "@/lib/i18n";
import { defaultLanguageCode, languageOptions } from "@/lib/languages";
import { createBuiltinLocalProviders, refreshBuiltinLocalProvider } from "@/lib/local-agents";
import { normalizeKnownProviderEndpoint } from "@/lib/providers";
import type { AgentRole, AppState, ChatAttachment, ChatMessage, ChatRoom } from "@/lib/types";

const STORAGE_KEY = "ai-roundtable-state-v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeState(value: Partial<AppState> | null): AppState {
  const fallback = createDefaultAppState();

  if (!value) {
    return fallback;
  }

  const rooms: ChatRoom[] = Array.isArray(value.rooms) && value.rooms.length > 0
    ? value.rooms.map((room): ChatRoom => ({
        ...room,
        mode: room.mode === "private" ? "private" : "group",
        contextMemory:
          room.contextMemory &&
          typeof room.contextMemory.summary === "string" &&
          typeof room.contextMemory.sourceMessageCount === "number" &&
          typeof room.contextMemory.throughMessageId === "string"
            ? room.contextMemory
            : undefined
      }))
    : fallback.rooms;
  const activeRoomId = rooms.some((room) => room.id === value.activeRoomId) ? String(value.activeRoomId) : rooms[0].id;
  const language = languageOptions.some((option) => option.code === value.settings?.language)
    ? value.settings?.language || defaultLanguageCode
    : defaultLanguageCode;
  const savedRoles = Array.isArray(value.roles) && value.roles.length > 0 ? (value.roles as AgentRole[]) : fallback.roles;
  const roleIds = new Set(savedRoles.map((role) => role.id));
  const fileMasterRole = fallback.roles.find((role) => role.id === FILE_MASTER_ROLE_ID);
  const roles = fileMasterRole && !roleIds.has(FILE_MASTER_ROLE_ID) ? [...savedRoles, fileMasterRole] : savedRoles;

  const savedProviders = Array.isArray(value.providers)
    ? value.providers.map(normalizeKnownProviderEndpoint).map(refreshBuiltinLocalProvider)
    : [];
  const providers =
    Number(value.version || 1) < 2
      ? [
          ...savedProviders,
          ...createBuiltinLocalProviders().filter(
            (builtin) => !savedProviders.some((provider) => provider.id === builtin.id)
          )
        ]
      : savedProviders;

  return {
    providers: providers.length > 0 ? providers : fallback.providers,
    roles,
    rooms,
    activeRoomId,
    settings: {
      language
    },
    version: 2
  };
}

export function loadAppState(): AppState {
  if (!canUseStorage()) {
    return createDefaultAppState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultAppState();
    }

    return normalizeState(JSON.parse(raw) as Partial<AppState>);
  } catch {
    return createDefaultAppState();
  }
}

export function saveAppState(state: AppState) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetAppState() {
  if (!canUseStorage()) {
    return createDefaultAppState();
  }

  window.localStorage.removeItem(STORAGE_KEY);
  return createDefaultAppState();
}

export function serializeRoomAsJson(room: ChatRoom) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: "AI圆桌",
      room
    },
    null,
    2
  );
}

export function serializeRoomAsMarkdown(room: ChatRoom, t?: Translator) {
  const lines = [
    `# ${room.name}`,
    "",
    `${t?.("markdownExportTime") || "导出时间"}：${new Date().toLocaleString("zh-CN")}`,
    "",
    `${t?.("markdownDefaultRounds") || "默认讨论轮数"}：${room.defaultRounds}`,
    "",
    `## ${t?.("markdownChatHistory") || "聊天记录"}`,
    ""
  ];

  if (room.messages.length === 0) {
    lines.push(t?.("markdownNoMessages") || "还没有消息。");
  } else {
    room.messages.forEach((message) => {
      lines.push(`### ${message.roleName}`);
      lines.push("");
      lines.push(`${t?.("markdownTime") || "时间"}：${new Date(message.createdAt).toLocaleString("zh-CN")}`);
      if (message.status === "error" && message.error) {
        lines.push("");
        lines.push(`${t?.("markdownError") || "错误"}：${message.error}`);
      }
      lines.push("");
      lines.push(message.content || t?.("markdownEmpty") || "（空）");
      if (message.attachments?.length) {
        lines.push("");
        lines.push("附件：");
        message.attachments.forEach((attachment) => {
          lines.push(`- ${attachment.name} (${attachment.mimeType || attachment.kind})`);
        });
      }
      lines.push("");
    });
  }

  return lines.join("\n");
}

export function serializeRoomAsText(room: ChatRoom, t?: Translator) {
  const lines = [
    room.name,
    `${t?.("markdownExportTime") || "导出时间"}：${new Date().toLocaleString("zh-CN")}`,
    `${t?.("markdownDefaultRounds") || "默认讨论轮数"}：${room.defaultRounds}`,
    "",
    t?.("markdownChatHistory") || "聊天记录",
    ""
  ];

  if (room.messages.length === 0) {
    lines.push(t?.("markdownNoMessages") || "还没有消息。");
  } else {
    room.messages.forEach((message) => {
      lines.push(`[${new Date(message.createdAt).toLocaleString("zh-CN")}] ${message.roleName}`);
      if (message.status === "error" && message.error) {
        lines.push(`${t?.("markdownError") || "错误"}：${message.error}`);
      }
      lines.push(message.content || t?.("markdownEmpty") || "（空）");
      if (message.attachments?.length) {
        lines.push("附件：");
        message.attachments.forEach((attachment) => {
          lines.push(`- ${attachment.name} (${attachment.mimeType || attachment.kind})`);
        });
      }
      lines.push("");
    });
  }

  return lines.join("\n");
}

export function parseImportedMessages(raw: string): ChatMessage[] {
  const parsed = JSON.parse(raw) as unknown;
  const maybeRoom = parsed && typeof parsed === "object" && "room" in parsed ? (parsed as { room?: unknown }).room : parsed;
  const messages =
    maybeRoom && typeof maybeRoom === "object" && "messages" in maybeRoom
      ? (maybeRoom as { messages?: unknown }).messages
      : maybeRoom;

  if (!Array.isArray(messages)) {
    throw new Error("导入文件中没有可识别的聊天记录。");
  }

  return messages.map((message) => {
    const item = message as Partial<ChatMessage>;
    if (!item.id || !item.content || !item.createdAt) {
      throw new Error("导入文件的消息格式不完整。");
    }

    return {
      id: String(item.id),
      roomId: String(item.roomId || ""),
      role: item.role === "user" || item.role === "summary" ? item.role : "assistant",
      roleId: item.roleId,
      roleName: String(item.roleName || "未知角色"),
      content: String(item.content),
      attachments: Array.isArray(item.attachments)
        ? item.attachments.map((attachment) => {
            const file = attachment as Partial<ChatAttachment>;
            return {
              id: String(file.id || ""),
              name: String(file.name || "未命名附件"),
              mimeType: String(file.mimeType || "application/octet-stream"),
              size: Number(file.size || 0),
              kind: file.kind || "unknown",
              dataUrl: file.dataUrl ? String(file.dataUrl) : undefined,
              extractedText: file.extractedText ? String(file.extractedText) : undefined,
              status: file.status || "partial",
              error: file.error ? String(file.error) : undefined,
              createdAt: String(file.createdAt || new Date().toISOString())
            };
          })
        : undefined,
      createdAt: String(item.createdAt),
      status: item.status === "pending" || item.status === "error" ? item.status : "success",
      error: item.error ? String(item.error) : undefined
    };
  });
}
