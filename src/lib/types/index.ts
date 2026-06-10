export type ProviderProtocol = "openai-compatible" | "anthropic";

export type MessageRole = "user" | "assistant" | "summary";

export type MessageStatus = "pending" | "success" | "error";

export type RoomMode = "group" | "private";

export type ChatAttachmentKind = "image" | "pdf" | "document" | "spreadsheet" | "presentation" | "text" | "html" | "unknown";

export type ChatAttachmentStatus = "ready" | "partial" | "unsupported" | "error";

export type LanguageCode =
  | "en"
  | "zh-Hans"
  | "zh-Hant"
  | "ja"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "ru"
  | "ar"
  | "ko"
  | "it"
  | "nl";

export interface AppSettings {
  language: LanguageCode;
}

export interface ProviderConfig {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  lastTestStatus?: "success" | "failed" | "untested";
}

export interface ProviderTemplate {
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  recommendedModels: string[];
}

export interface AgentRole {
  id: string;
  name: string;
  avatarColor: string;
  avatarImage?: string;
  identityFileName?: string;
  identityFileContent?: string;
  identityFileUpdatedAt?: string;
  systemPrompt: string;
  speakingStyle: string;
  providerId: string;
  model: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: ChatAttachmentKind;
  dataUrl?: string;
  extractedText?: string;
  status: ChatAttachmentStatus;
  error?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  role: MessageRole;
  roleId?: string;
  roleName: string;
  content: string;
  attachments?: ChatAttachment[];
  createdAt: string;
  status: MessageStatus;
  error?: string;
}

export interface RoomContextMemory {
  summary: string;
  sourceMessageCount: number;
  throughMessageId: string;
  updatedAt: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  mode: RoomMode;
  roleIds: string[];
  defaultRounds: number;
  messages: ChatMessage[];
  contextMemory?: RoomContextMemory;
  createdAt: string;
  updatedAt: string;
}

export interface AppState {
  providers: ProviderConfig[];
  roles: AgentRole[];
  rooms: ChatRoom[];
  activeRoomId: string;
  settings: AppSettings;
  version: number;
}

export interface ModelMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
}

export interface ModelInput {
  provider: ProviderConfig;
  model?: string;
  systemPrompt: string;
  messages: ModelMessage[];
  signal?: AbortSignal;
}

export interface ModelResponse {
  content: string;
  raw?: unknown;
}
