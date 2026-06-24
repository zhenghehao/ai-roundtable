"use client";

import {
  ArrowUp,
  Check,
  ChevronDown,
  FileUp,
  Paperclip,
  Pencil,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { RoleAvatar } from "@/components/roles/RoleAvatar";
import { Button } from "@/components/ui/Button";
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
  LocalAgentModelCatalog,
  ProviderConfig
} from "@/lib/types";
import { clampRounds, cn } from "@/lib/utils";

interface ChatViewProps {
  room: ChatRoom;
  roles: AgentRole[];
  providers: ProviderConfig[];
  localAgentModelCatalogs: LocalAgentModelCatalog[];
  isRunning: boolean;
  speakingRoleId?: string;
  onUpdateRoom: (room: ChatRoom) => void;
  onUpdateRoleModel: (roleId: string, model: string) => void;
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
  localAgentModelCatalogs,
  isRunning,
  speakingRoleId,
  onUpdateRoom,
  onUpdateRoleModel,
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
    </div>
  );
}
