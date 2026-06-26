"use client";

import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  FileUp,
  Folder,
  Paperclip,
  Pencil,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { RoleAvatar } from "@/components/roles/RoleAvatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  ACCEPTED_CHAT_ATTACHMENT_TYPES,
  createChatAttachment,
  formatFileSize,
  isSupportedChatAttachment,
  MAX_ATTACHMENT_BYTES
} from "@/lib/attachments";
import { useI18n } from "@/lib/i18n-context";
import type {
  AgentRole,
  ChatAttachment,
  ChatMessage,
  ChatRoom,
  KnowledgeBaseEntry,
  KnowledgeBaseListResult,
  KnowledgeBaseSearchResult,
  KnowledgeBaseSelection,
  KnowledgeBaseSettings,
  LocalAgentModelCatalog,
  ProviderConfig
} from "@/lib/types";
import { clampRounds, cn } from "@/lib/utils";

interface ChatViewProps {
  room: ChatRoom;
  roles: AgentRole[];
  providers: ProviderConfig[];
  knowledgeBase: KnowledgeBaseSettings;
  isDesktopApp: boolean;
  localAgentModelCatalogs: LocalAgentModelCatalog[];
  isRunning: boolean;
  speakingRoleId?: string;
  onUpdateRoom: (room: ChatRoom) => void;
  onUpdateRoomKnowledgeBase: (roomId: string, patch: Partial<NonNullable<ChatRoom["knowledgeBase"]>>) => void;
  onUpdateRoleModel: (roleId: string, model: string) => void;
  onSelectKnowledgeBase: () => void;
  onListKnowledgeBaseEntries: (relativePath?: string) => Promise<KnowledgeBaseListResult>;
  onSearchKnowledgeBase: (query: string) => Promise<KnowledgeBaseSearchResult>;
  onStart: (topic: string, rounds: number, attachments?: ChatAttachment[]) => void;
  onContinue: (rounds: number) => void;
  onStop: () => void;
  onSummarize: () => void;
  onClear: () => void;
  onCopyMessage: (message: ChatMessage) => void;
  onDeleteMessage: (messageId: string) => void;
}

export function ChatView({
  room,
  roles,
  providers,
  knowledgeBase,
  isDesktopApp,
  localAgentModelCatalogs,
  isRunning,
  speakingRoleId,
  onUpdateRoom,
  onUpdateRoomKnowledgeBase,
  onUpdateRoleModel,
  onSelectKnowledgeBase,
  onListKnowledgeBaseEntries,
  onSearchKnowledgeBase,
  onStart,
  onContinue,
  onStop,
  onSummarize,
  onClear,
  onCopyMessage,
  onDeleteMessage
}: ChatViewProps) {
  const { t } = useI18n();
  const [topic, setTopic] = useState("");
  const [editingRoomName, setEditingRoomName] = useState(false);
  const [roomNameDraft, setRoomNameDraft] = useState(room.name);
  const [mentionQuery, setMentionQuery] = useState<string | undefined>();
  const [mentionStart, setMentionStart] = useState<number | undefined>();
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeBaseListResult | undefined>();
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeSearchQuery, setKnowledgeSearchQuery] = useState("");
  const [knowledgeSearchResult, setKnowledgeSearchResult] = useState<KnowledgeBaseSearchResult | undefined>();
  const [knowledgeSearching, setKnowledgeSearching] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedRoles = room.roleIds
    .map((roleId) => roles.find((role) => role.id === roleId))
    .filter((role): role is AgentRole => Boolean(role));
  const roleChips = useMemo(
    () => [...selectedRoles, ...roles.filter((role) => !room.roleIds.includes(role.id))],
    [roles, room.roleIds, selectedRoles]
  );
  const enabledSelectedRoles = selectedRoles.filter((role) => role.enabled);
  const speakingRole = roles.find((role) => role.id === speakingRoleId);
  const selectedKnowledgeItems = room.knowledgeBase?.selectedItems || [];
  const knowledgeEnabled = room.knowledgeBase?.enabled ?? Boolean(knowledgeBase.enabled && knowledgeBase.vaultPath);
  const knowledgeMode = room.knowledgeBase?.mode || "auto";
  const modelCatalogByProviderId = useMemo(
    () => new Map(localAgentModelCatalogs.map((catalog) => [catalog.id, catalog])),
    [localAgentModelCatalogs]
  );
  const mentionCandidates = useMemo(() => {
    if (mentionQuery === undefined) {
      return [];
    }

    const query = mentionQuery.trim().toLowerCase();
    return enabledSelectedRoles.filter((role) => !query || role.name.toLowerCase().includes(query));
  }, [enabledSelectedRoles, mentionQuery]);

  useEffect(() => {
    if (room.messages.length > 0) {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [room.messages.length, room.messages.at(-1)?.content]);

  useEffect(() => {
    setRoomNameDraft(room.name);
    setEditingRoomName(false);
  }, [room.id, room.name]);

  useEffect(() => {
    if (!knowledgeOpen || !knowledgeBase.vaultPath) {
      return;
    }

    setKnowledgeSearchQuery("");
    setKnowledgeSearchResult(undefined);
    void loadKnowledgeEntries("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgeOpen, knowledgeBase.vaultPath]);

  const loadKnowledgeEntries = async (relativePath = "") => {
    setKnowledgeLoading(true);
    try {
      setKnowledgeList(await onListKnowledgeBaseEntries(relativePath));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "知识库目录读取失败。");
    } finally {
      setKnowledgeLoading(false);
    }
  };

  const openKnowledgeSelector = () => {
    if (!isDesktopApp) {
      window.alert("选择本地知识库笔记需要使用 AI圆桌桌面版。");
      return;
    }
    if (!knowledgeBase.vaultPath) {
      onSelectKnowledgeBase();
      return;
    }
    setKnowledgeOpen(true);
  };

  const updateKnowledge = (patch: Partial<NonNullable<ChatRoom["knowledgeBase"]>>) => {
    onUpdateRoomKnowledgeBase(room.id, {
      enabled: knowledgeEnabled,
      mode: knowledgeMode,
      selectedItems: selectedKnowledgeItems,
      maxNotes: room.knowledgeBase?.maxNotes || knowledgeBase.maxNotes,
      maxCharsPerNote: room.knowledgeBase?.maxCharsPerNote || knowledgeBase.maxCharsPerNote,
      ...patch
    });
  };

  const toggleKnowledgeSelection = (selection: KnowledgeBaseSelection) => {
    const exists = selectedKnowledgeItems.some((item) => item.kind === selection.kind && item.relativePath === selection.relativePath);
    const nextItems = exists
      ? selectedKnowledgeItems.filter((item) => !(item.kind === selection.kind && item.relativePath === selection.relativePath))
      : [...selectedKnowledgeItems, selection];

    updateKnowledge({
      enabled: true,
      mode: "selection",
      selectedItems: nextItems
    });
  };

  const toggleKnowledgeItem = (entry: KnowledgeBaseEntry) => {
    toggleKnowledgeSelection({ kind: entry.kind, relativePath: entry.relativePath, title: entry.title });
  };

  const removeKnowledgeItem = (item: KnowledgeBaseSelection) => {
    updateKnowledge({
      selectedItems: selectedKnowledgeItems.filter(
        (candidate) => !(candidate.kind === item.kind && candidate.relativePath === item.relativePath)
      )
    });
  };

  const parentKnowledgePath = (relativePath: string) => {
    const parts = relativePath.split(/[\\/]/).filter(Boolean);
    parts.pop();
    return parts.join("/");
  };

  const knowledgeSelectionSummary = () => {
    const fileCount = selectedKnowledgeItems.filter((item) => item.kind === "file").length;
    const directoryCount = selectedKnowledgeItems.filter((item) => item.kind === "directory").length;
    const parts = [
      directoryCount > 0 ? `${directoryCount} 个文件夹` : "",
      fileCount > 0 ? `${fileCount} 篇笔记` : ""
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" + ") : "自动检索";
  };

  const selectedItemKey = (item: Pick<KnowledgeBaseSelection, "kind" | "relativePath">) => `${item.kind}:${item.relativePath}`;

  const mergeKnowledgeItems = (items: KnowledgeBaseSelection[]) => {
    const merged = new Map(selectedKnowledgeItems.map((item) => [selectedItemKey(item), item]));
    items.forEach((item) => merged.set(selectedItemKey(item), item));
    updateKnowledge({
      enabled: true,
      mode: "selection",
      selectedItems: Array.from(merged.values())
    });
  };

  const selectCurrentKnowledgeDirectory = () => {
    const relativePath = knowledgeList?.relativePath || ".";
    const title =
      relativePath === "."
        ? "全部知识库"
        : relativePath.split(/[\\/]/).filter(Boolean).at(-1) || relativePath;

    mergeKnowledgeItems([
      {
        kind: "directory",
        relativePath,
        title
      }
    ]);
  };

  const selectVisibleKnowledgeEntries = () => {
    const entries = knowledgeList?.entries || [];
    if (entries.length === 0) {
      return;
    }

    mergeKnowledgeItems(entries.map((entry) => ({
      kind: entry.kind,
      relativePath: entry.relativePath,
      title: entry.title
    })));
  };

  const searchKnowledgeEntries = async () => {
    const query = knowledgeSearchQuery.trim();
    if (!query) {
      return;
    }

    setKnowledgeSearching(true);
    try {
      setKnowledgeSearchResult(await onSearchKnowledgeBase(query));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "知识库搜索失败。");
    } finally {
      setKnowledgeSearching(false);
    }
  };

  const toggleKnowledgeSearchHit = (hit: KnowledgeBaseSearchResult["hits"][number]) => {
    toggleKnowledgeSelection({ kind: "file", relativePath: hit.relativePath, title: hit.title });
  };

  const selectKnowledgeSearchResults = () => {
    const hits = knowledgeSearchResult?.hits || [];
    if (hits.length === 0) {
      return;
    }

    mergeKnowledgeItems(hits.map((hit) => ({
      kind: "file",
      relativePath: hit.relativePath,
      title: hit.title
    })));
  };

  const saveRoomName = () => {
    const nextName = roomNameDraft.trim();
    if (!nextName) {
      setRoomNameDraft(room.name);
      setEditingRoomName(false);
      return;
    }

    if (nextName !== room.name) {
      onUpdateRoom({
        ...room,
        name: nextName
      });
    }
    setEditingRoomName(false);
  };

  const setRounds = (value: number) => {
    onUpdateRoom({
      ...room,
      defaultRounds: clampRounds(value)
    });
  };

  const toggleRole = (roleId: string) => {
    const nextIds =
      room.mode === "private"
        ? room.roleIds.includes(roleId)
          ? []
          : [roleId]
        : room.roleIds.includes(roleId)
          ? room.roleIds.filter((item) => item !== roleId)
          : [...room.roleIds, roleId];

    onUpdateRoom({
      ...room,
      roleIds: nextIds
    });
  };

  const updateRoleModel = (role: AgentRole, value: string) => {
    if (value === "__custom__") {
      const customModel = window.prompt("请输入该 CLI 支持的模型名", role.model)?.trim();
      if (customModel) {
        onUpdateRoleModel(role.id, customModel);
      }
      return;
    }

    onUpdateRoleModel(role.id, value);
  };

  const updateMentionState = (value: string, caretPosition: number) => {
    const beforeCaret = value.slice(0, caretPosition);
    const atIndex = beforeCaret.lastIndexOf("@");

    if (atIndex < 0) {
      setMentionQuery(undefined);
      setMentionStart(undefined);
      return;
    }

    const rawQuery = beforeCaret.slice(atIndex + 1);
    const query = rawQuery.replace(/^\s+/, "");
    if (/[\n，,。；;：:]/.test(rawQuery) || /\s/.test(query)) {
      setMentionQuery(undefined);
      setMentionStart(undefined);
      return;
    }

    setMentionQuery(query);
    setMentionStart(atIndex);
  };

  const insertMention = (role: AgentRole) => {
    const textarea = textareaRef.current;
    const caretPosition = textarea?.selectionStart ?? topic.length;
    const start = mentionStart ?? caretPosition;
    const nextTopic = `${topic.slice(0, start)}@${role.name} ${topic.slice(caretPosition)}`;
    const nextCaret = start + role.name.length + 2;

    setTopic(nextTopic);
    setMentionQuery(undefined);
    setMentionStart(undefined);
    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret);
    }, 0);
  };

  const startDiscussion = () => {
    const trimmed = topic.trim();
    if (!trimmed && pendingAttachments.length === 0) {
      window.alert(t("alertNeedTopicOrAttachment"));
      return;
    }

    onStart(trimmed, room.defaultRounds, pendingAttachments);
    setTopic("");
    setPendingAttachments([]);
  };

  const removeAttachment = (attachmentId: string) => {
    setPendingAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  };

  const handleFiles = async (fileList?: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const files = Array.from(fileList);

    for (const file of files) {
      if (!isSupportedChatAttachment(file)) {
        window.alert(t("unsupportedAttachment", { name: file.name }));
        continue;
      }

      if (file.size > MAX_ATTACHMENT_BYTES) {
        window.alert(t("attachmentTooLarge", { name: file.name, size: formatFileSize(MAX_ATTACHMENT_BYTES) }));
        continue;
      }

      try {
        const attachment = await createChatAttachment(file);
        setPendingAttachments((current) => [...current, attachment]);
      } catch {
        window.alert(t("attachmentReadFailed", { name: file.name }));
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="h-full min-h-0">
      <section className="chat-surface app-surface flex h-full min-h-0 flex-col overflow-hidden rounded-[21px]">
        <header className="chat-header border-b px-5 py-[18px] md:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                {editingRoomName ? (
                  <div className="flex min-w-0 items-center gap-2">
                    <input
                      autoFocus
                      className="room-name-input h-10 min-w-0 max-w-xl flex-1 rounded-[10px] border px-3 text-lg font-semibold outline-none ring-[3px]"
                      value={roomNameDraft}
                      onChange={(event) => setRoomNameDraft(event.target.value)}
                      onBlur={saveRoomName}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          saveRoomName();
                        }
                        if (event.key === "Escape") {
                          setRoomNameDraft(room.name);
                          setEditingRoomName(false);
                        }
                      }}
                    />
                    <Button className="h-8 w-8 rounded-lg" size="icon" variant="ghost" title={t("saveRoomName")} onMouseDown={(event) => event.preventDefault()} onClick={saveRoomName}>
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <h2 className="page-heading truncate text-[22px] font-semibold text-[var(--ink)]">{room.name}</h2>
                    <Button
                      className="h-8 w-8 shrink-0 rounded-lg"
                      size="icon"
                      variant="ghost"
                      title={t("editRoomName")}
                      disabled={isRunning}
                      onClick={() => setEditingRoomName(true)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--muted)]">
                <span>
                  {enabledSelectedRoles.length > 0 ? t("enabledRoleCount", { count: enabledSelectedRoles.length }) : t("noSpeakingRoles")}
                </span>
                <span className="text-[var(--line-strong)]">/</span>
                <span>
                  {t(room.mode === "private" ? "privateChatBadge" : "groupChatBadge")}
                </span>
                <span className="text-[var(--line-strong)]">/</span>
                <span>{t("roundUnit", { count: room.defaultRounds })}</span>
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {t("localSave")}
                </span>
                <span className={`inline-flex items-center gap-1 ${knowledgeEnabled ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}>
                  <BookOpen className="h-3 w-3" />
                  {knowledgeEnabled
                    ? knowledgeMode === "selection" && selectedKnowledgeItems.length > 0
                      ? `知识库 ${knowledgeSelectionSummary()}`
                      : "知识库自动检索"
                    : "知识库关闭"}
                </span>
                {speakingRole ? (
                  <span className="inline-flex items-center gap-1 font-medium text-[var(--accent)]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
                    {t("roleSpeaking", { name: speakingRole.name }).replace(/^[，,]\s?/, "")}
                  </span>
                ) : null}
              </div>
            </div>
            <label className="mr-3 flex items-center gap-2 text-xs font-medium text-[var(--muted)] md:mr-5">
              {t("discussionRounds")}
              <span className="relative">
                <select
                  className="round-select h-9 appearance-none rounded-[9px] border py-0 pl-2.5 pr-7 text-sm outline-none transition focus:ring-2"
                  value={room.defaultRounds}
                  onChange={(event) => setRounds(Number(event.target.value))}
                  disabled={isRunning}
                >
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((round) => (
                    <option key={round} value={round}>
                      {t("roundUnit", { count: round })}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
              </span>
            </label>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {roles.length === 0 ? (
              <span className="text-sm text-slate-500">{t("noRolesCreateFirst")}</span>
            ) : (
              roleChips.map((role) => {
                const checked = room.roleIds.includes(role.id);
                const orderIndex = room.roleIds.indexOf(role.id);
                const provider = providers.find((item) => item.id === role.providerId);
                const modelCatalog = provider ? modelCatalogByProviderId.get(provider.id) : undefined;
                const hasLocalModelCatalog = Boolean(provider?.localCli || provider?.protocol === "ollama");
                const selectedModel = role.model || provider?.defaultModel || "";
                const modelOptions = Array.from(
                  new Map(
                    [
                      ...(selectedModel ? [{ id: selectedModel }] : []),
                      ...(provider?.defaultModel ? [{ id: provider.defaultModel }] : []),
                      ...(modelCatalog?.models || [])
                    ].map((model) => [model.id, model])
                  ).values()
                );
                return (
                  <div
                    key={role.id}
                    className={cn(
                      "flex h-8 shrink-0 items-center gap-2 rounded-[10px] border px-2.5 text-xs font-medium transition duration-200",
                      checked ? "role-chip-selected" : "role-chip-idle",
                      !role.enabled ? "opacity-50" : ""
                    )}
                    title={role.enabled ? role.name : `${role.name} ${t("disabled")}`}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-2"
                      onClick={() => toggleRole(role.id)}
                      disabled={isRunning}
                    >
                      <RoleAvatar role={role} size="xs" />
                      {checked && room.mode !== "private" ? (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-[5px] bg-[var(--accent)] px-1 text-[9px] font-semibold text-white">
                          {orderIndex + 1}
                        </span>
                      ) : null}
                      <span className="whitespace-nowrap">{role.name}</span>
                    </button>
                    {checked && hasLocalModelCatalog ? (
                      <span
                        className="relative ml-0.5 flex items-center border-l border-current/15 pl-2"
                        title={modelCatalog?.message || "选择该角色调用本地运行时时使用的模型"}
                      >
                        <select
                          aria-label={`${role.name} 模型`}
                          className="h-6 max-w-[150px] appearance-none bg-transparent py-0 pl-1 pr-5 text-[10px] font-medium outline-none"
                          value={selectedModel}
                          disabled={isRunning || modelCatalog?.supportsSelection === false}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => updateRoleModel(role, event.target.value)}
                        >
                          <option value="">
                            {provider?.defaultModel
                              ? `配置默认：${provider.defaultModel}`
                              : provider?.protocol === "local-cli"
                                ? "CLI 默认模型"
                                : "不指定模型"}
                          </option>
                          {modelOptions.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.label && model.label !== model.id ? `${model.label} (${model.id})` : model.id}
                            </option>
                          ))}
                          <option value="__custom__">自定义模型...</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 opacity-60" />
                      </span>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </header>

        <main className="chat-stage subtle-grid min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          {providers.length === 0 ? (
            <div className="mx-auto mt-5 max-w-4xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {t("noProviderNotice")}
            </div>
          ) : null}
          {room.messages.length === 0 ? (
            <div className="flex min-h-full items-center justify-center px-6 text-center">
              <div className="empty-state max-w-lg">
                <p className="empty-slogan page-heading text-[17px] font-normal tracking-[-0.02em]">
                  从不同的答案，走向更好的答案
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl py-5">
              {room.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  role={roles.find((role) => role.id === message.roleId)}
                  onCopy={onCopyMessage}
                  onDelete={onDeleteMessage}
                />
              ))}
            </div>
          )}
          <div ref={messageEndRef} />
        </main>

        <footer className="composer-shell border-t px-4 py-4 md:px-6 md:py-5">
          <div className="composer rounded-[17px] border p-3 focus-within:ring-[3px]">
            <textarea
              ref={textareaRef}
              className="min-h-20 w-full resize-none rounded-[10px] border-0 bg-transparent px-2.5 py-2 text-[14px] leading-6 text-[var(--ink)] outline-none placeholder:text-[var(--placeholder)] disabled:bg-[var(--canvas)]"
              value={topic}
              onChange={(event) => {
                setTopic(event.target.value);
                updateMentionState(event.target.value, event.target.selectionStart);
              }}
              onClick={(event) => updateMentionState(topic, event.currentTarget.selectionStart)}
              onKeyUp={(event) => updateMentionState(topic, event.currentTarget.selectionStart)}
              placeholder={t("topicPlaceholder")}
              disabled={isRunning}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  startDiscussion();
                }
              }}
            />
            {mentionQuery !== undefined ? (
              <div className="mb-2 max-h-44 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-2 scrollbar-thin">
                {mentionCandidates.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400">{t("mentionNoRoles")}</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {mentionCandidates.map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        className="flex items-center gap-2 rounded-[9px] border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-1.5 text-sm text-[var(--muted)] transition hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
                        onClick={() => insertMention(role)}
                      >
                        <RoleAvatar role={role} size="xs" />
                        <span>@{role.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            {pendingAttachments.length > 0 ? (
              <div className="mb-2 grid gap-2 px-1 sm:grid-cols-2">
                {pendingAttachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2">
                    {attachment.kind === "image" && attachment.dataUrl ? (
                      <img src={attachment.dataUrl} alt={attachment.name} className="h-10 w-10 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--surface-strong)] text-[var(--accent)]">
                        <FileUp className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="card-title truncate text-xs font-semibold">{attachment.name}</div>
                      <div className="card-copy mt-0.5 text-[11px]">
                        {formatFileSize(attachment.size)}
                        {attachment.extractedText ? ` · ${t("contentReadable")}` : ""}
                      </div>
                    </div>
                    <Button className="h-7 w-7 rounded-lg" size="icon" variant="ghost" title={t("removeAttachment")} onClick={() => removeAttachment(attachment.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            {knowledgeEnabled ? (
              <button
                type="button"
                className="mb-2 flex max-w-full items-center gap-2 rounded-[9px] border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1.5 text-left text-xs text-[var(--accent-strong)] transition hover:bg-white/70"
                onClick={openKnowledgeSelector}
                title="点击管理知识库来源"
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {knowledgeMode === "selection" && selectedKnowledgeItems.length > 0
                    ? `知识库已选：${knowledgeSelectionSummary()}`
                    : "知识库：自动按话题检索"}
                </span>
              </button>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line-soft)] pt-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_CHAT_ATTACHMENT_TYPES}
                  className="hidden"
                  onChange={(event) => void handleFiles(event.target.files)}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  title={t("uploadAttachment")}
                  disabled={isRunning}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4" />
                  {t("uploadAttachment")}
                </Button>
                <Button
                  size="sm"
                  variant={knowledgeEnabled ? "primary" : "secondary"}
                  title="选择知识库笔记或文件夹"
                  disabled={isRunning}
                  onClick={openKnowledgeSelector}
                >
                  <BookOpen className="h-4 w-4" />
                  知识库
                </Button>
                {room.messages.length > 0 ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => onContinue(1)} disabled={isRunning}>
                      <RotateCcw className="h-3.5 w-3.5" />
                      {t("continueRound")}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={onSummarize} disabled={isRunning}>
                      <Sparkles className="h-3.5 w-3.5" />
                      {t("generateSummary")}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={onClear} disabled={isRunning}>
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("clear")}
                    </Button>
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <Button size="sm" variant="danger" onClick={onStop}>
                    <Square className="h-4 w-4" />
                    {t("stop")}
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" onClick={startDiscussion} disabled={isRunning}>
                    {t("startDiscussion")}
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            <div className="brand-microcopy mt-3 text-center text-[10px] tracking-[0.08em]">
              从不同的答案，走向更好的答案
            </div>
          </div>
        </footer>
      </section>
      <Modal title="选择知识库内容" description="选择自动检索，或精确勾选要参与本房间讨论的笔记和文件夹。" open={knowledgeOpen} onClose={() => setKnowledgeOpen(false)}>
        <div className="space-y-4">
          <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface-muted)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
                <input
                  type="checkbox"
                  checked={knowledgeEnabled}
                  className="h-4 w-4 accent-[var(--accent)]"
                  onChange={(event) => updateKnowledge({ enabled: event.target.checked })}
                />
                当前房间使用知识库
              </label>
              <select
                className="field-control h-9 rounded-[9px] border px-3 text-xs outline-none transition focus:ring-[3px]"
                value={knowledgeMode}
                disabled={!knowledgeEnabled}
                onChange={(event) => updateKnowledge({ mode: event.target.value as NonNullable<ChatRoom["knowledgeBase"]>["mode"] })}
              >
                <option value="auto">自动按话题检索</option>
                <option value="selection">只使用手动选择</option>
              </select>
            </div>
            <div className="mt-2 truncate font-mono text-[11px] text-[var(--muted)]">
              {knowledgeBase.vaultPath || "尚未选择笔记目录"}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-[1.25fr_1fr]">
            <div className="min-w-0">
              <form
                className="mb-4 rounded-[12px] border border-[var(--line)] bg-[var(--surface-strong)] p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void searchKnowledgeEntries();
                }}
              >
                <div className="flex gap-2">
                  <input
                    value={knowledgeSearchQuery}
                    onChange={(event) => setKnowledgeSearchQuery(event.target.value)}
                    className="field-control h-9 min-w-0 flex-1 rounded-[9px] border px-3 text-sm outline-none transition focus:ring-[3px]"
                    placeholder="搜索文件名、摘要、人物、标签或事件"
                    disabled={!knowledgeEnabled}
                  />
                  <Button type="submit" size="sm" variant="primary" disabled={!knowledgeEnabled || knowledgeSearching || !knowledgeSearchQuery.trim()}>
                    <Search className="h-3.5 w-3.5" />
                    {knowledgeSearching ? "搜索中" : "搜索"}
                  </Button>
                </div>

                {knowledgeSearchResult ? (
                  <div className="mt-3 border-t border-[var(--line)] pt-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
                      <span>
                        {knowledgeSearchResult.hits.length > 0
                          ? `找到 ${knowledgeSearchResult.hits.length} 篇 · 扫描 ${knowledgeSearchResult.scannedFileCount} 篇`
                          : `未找到匹配 · 扫描 ${knowledgeSearchResult.scannedFileCount} 篇`}
                      </span>
                      {knowledgeSearchResult.hits.length > 0 ? (
                        <Button type="button" size="sm" variant="secondary" onClick={selectKnowledgeSearchResults}>
                          全选搜索结果
                        </Button>
                      ) : null}
                    </div>
                    {knowledgeSearchResult.hits.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                        <div className="space-y-1">
                          {knowledgeSearchResult.hits.map((hit) => {
                            const checked = selectedKnowledgeItems.some((item) => item.kind === "file" && item.relativePath === hit.relativePath);
                            return (
                              <label
                                key={hit.relativePath}
                                className="flex min-w-0 cursor-pointer gap-2 rounded-[9px] px-2 py-1.5 text-sm text-[var(--ink-soft)] hover:bg-[var(--surface-muted)]"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                                  onChange={() => toggleKnowledgeSearchHit(hit)}
                                />
                                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium">{hit.title}</span>
                                  <span className="block truncate font-mono text-[10px] text-[var(--muted)]" title={hit.relativePath}>
                                    {hit.relativePath}
                                  </span>
                                  <span className="mt-1 block max-h-8 overflow-hidden text-[11px] leading-4 text-[var(--muted)]">
                                    {hit.excerpt}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="px-2 py-4 text-center text-sm text-[var(--muted)]">换个关键词试试。</div>
                    )}
                  </div>
                ) : null}
              </form>

              <div className="mb-3 space-y-2">
                <div className="truncate text-xs font-semibold text-[var(--muted)]">
                  {knowledgeList?.relativePath ? `当前：${knowledgeList.relativePath}` : "当前：根目录"}
                </div>
                <div className="flex flex-wrap gap-2">
                  {knowledgeList?.relativePath ? (
                    <Button size="sm" variant="ghost" onClick={() => void loadKnowledgeEntries(parentKnowledgePath(knowledgeList.relativePath))}>
                      上一级
                    </Button>
                  ) : null}
                  <Button size="sm" variant="secondary" onClick={selectCurrentKnowledgeDirectory} disabled={!knowledgeList}>
                    选择当前目录
                  </Button>
                  <Button size="sm" variant="secondary" onClick={selectVisibleKnowledgeEntries} disabled={!knowledgeList?.entries.length}>
                    全选当前列表
                  </Button>
                  <Button size="sm" variant="secondary" onClick={onSelectKnowledgeBase}>
                    换目录
                  </Button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto rounded-[12px] border border-[var(--line)] bg-[var(--surface-strong)] p-2 scrollbar-thin">
                {knowledgeLoading ? (
                  <div className="px-3 py-8 text-center text-sm text-[var(--muted)]">正在读取目录...</div>
                ) : knowledgeList?.entries.length ? (
                  <div className="space-y-1">
                    {knowledgeList.entries.map((entry) => {
                      const checked = selectedKnowledgeItems.some((item) => item.kind === entry.kind && item.relativePath === entry.relativePath);
                      return (
                        <div key={`${entry.kind}:${entry.relativePath}`} className="flex items-center gap-2 rounded-[9px] px-2 py-1.5 hover:bg-[var(--surface-muted)]">
                          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-[var(--ink-soft)]">
                            <input
                              type="checkbox"
                              checked={checked}
                              className="h-4 w-4 accent-[var(--accent)]"
                              onChange={() => toggleKnowledgeItem(entry)}
                            />
                            {entry.kind === "directory" ? <Folder className="h-4 w-4 shrink-0 text-[var(--accent)]" /> : <FileText className="h-4 w-4 shrink-0 text-[var(--muted)]" />}
                            <span className="truncate">{entry.title}</span>
                          </label>
                          {entry.kind === "directory" ? (
                            <Button size="sm" variant="ghost" onClick={() => void loadKnowledgeEntries(entry.relativePath)}>
                              进入
                            </Button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-3 py-8 text-center text-sm text-[var(--muted)]">这个目录下没有 Markdown 笔记。</div>
                )}
              </div>
            </div>

            <div className="min-w-0">
              <div className="mb-2 text-xs font-semibold text-[var(--muted)]">已选知识来源</div>
              <div className="max-h-80 overflow-y-auto rounded-[12px] border border-[var(--line)] bg-[var(--surface-strong)] p-2 scrollbar-thin">
                {selectedKnowledgeItems.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-[var(--muted)]">未选择具体笔记时，可使用自动检索。</div>
                ) : (
                  <div className="space-y-1">
                    {selectedKnowledgeItems.map((item) => (
                      <div key={`${item.kind}:${item.relativePath}`} className="flex items-center gap-2 rounded-[9px] px-2 py-1.5 text-sm text-[var(--ink-soft)]">
                        {item.kind === "directory" ? <Folder className="h-4 w-4 shrink-0 text-[var(--accent)]" /> : <FileText className="h-4 w-4 shrink-0 text-[var(--muted)]" />}
                        <span className="min-w-0 flex-1 truncate" title={item.relativePath}>{item.title}</span>
                        <Button className="h-7 w-7 rounded-lg" size="icon" variant="ghost" title="移除" onClick={() => removeKnowledgeItem(item)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
            <Button type="button" variant="ghost" onClick={() => updateKnowledge({ selectedItems: [], mode: "auto" })}>
              清空选择
            </Button>
            <Button type="button" variant="primary" onClick={() => setKnowledgeOpen(false)}>
              完成
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
