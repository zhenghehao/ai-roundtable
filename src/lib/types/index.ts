export type ProviderProtocol = "openai-compatible" | "anthropic" | "local-cli" | "ollama";

export type LocalAgentCapability = "adapted" | "detect-only";

export type LocalCliInputMode = "stdin" | "argument";

export type LocalCliOutputFormat = "text" | "json" | "jsonl";

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

export type ThemeMode = "light" | "dark";

export interface AppSettings {
  language: LanguageCode;
  theme: ThemeMode;
  knowledgeBase: KnowledgeBaseSettings;
}

export interface KnowledgeBaseSettings {
  enabled: boolean;
  kind: "obsidian";
  vaultPath: string;
  maxNotes: number;
  maxCharsPerNote: number;
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
  localCli?: LocalCliConfig;
}

export interface LocalCliConfig {
  agentId: string;
  commandCandidates: string[];
  detectionPaths?: string[];
  args: string[];
  inputMode: LocalCliInputMode;
  outputFormat: LocalCliOutputFormat;
  resultPath?: string;
  capability: LocalAgentCapability;
  builtIn?: boolean;
}

export interface LocalAgentDetectionRequest {
  id: string;
  agentId?: string;
  commandCandidates: string[];
  detectionPaths?: string[];
  baseUrl?: string;
}

export interface LocalAgentDetection {
  id: string;
  installed: boolean;
  configured?: boolean;
  command?: string;
  path?: string;
  message?: string;
}

export type LocalAgentModelSource = "cli" | "server" | "package" | "cache" | "config" | "built-in" | "configured" | "unavailable";

export interface LocalAgentModelRequest {
  id: string;
  agentId: string;
  commandCandidates: string[];
  configuredModel?: string;
  args?: string[];
  baseUrl?: string;
}

export interface LocalAgentModelOption {
  id: string;
  label?: string;
}

export interface LocalAgentModelCatalog {
  id: string;
  models: LocalAgentModelOption[];
  defaultModel?: string;
  currentModel?: string;
  source: LocalAgentModelSource;
  supportsSelection: boolean;
  message?: string;
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

export interface KnowledgeBaseSearchRequest {
  vaultPath: string;
  query: string;
  limit?: number;
  maxCharsPerNote?: number;
}

export interface KnowledgeBaseSearchHit {
  title: string;
  relativePath: string;
  score: number;
  excerpt: string;
  modifiedAt?: string;
}

export interface KnowledgeBaseSearchResult {
  vaultPath: string;
  query: string;
  hits: KnowledgeBaseSearchHit[];
  scannedFileCount: number;
  message?: string;
}
