"use client";

import {
  ArrowUp,
  Bot,
  CheckCircle2,
  FileJson,
  FileText,
  Layers3,
  MessageCircle,
  Paperclip,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Users
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { RoleAvatar } from "@/components/roles/RoleAvatar";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n-context";
import type { AgentRole, ChatMessage, ChatRoom, ProviderConfig } from "@/lib/types";
import { clampRounds, cn } from "@/lib/utils";

interface ChatViewProps {
  room: ChatRoom;
  roles: AgentRole[];
  providers: ProviderConfig[];
  isRunning: boolean;
  speakingRoleId?: string;
  onUpdateRoom: (room: ChatRoom) => void;
  onStart: (topic: string, rounds: number) => void;
  onContinue: (rounds: number) => void;
  onStop: () => void;
  onSummarize: () => void;
  onClear: () => void;
  onCopyMessage: (message: ChatMessage) => void;
  onDeleteMessage: (messageId: string) => void;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  onExportText: () => void;
}

function ContextCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ChatView({
  room,
  roles,
  providers,
  isRunning,
  speakingRoleId,
  onUpdateRoom,
  onStart,
  onContinue,
  onStop,
  onSummarize,
  onClear,
  onCopyMessage,
  onDeleteMessage,
  onExportJson,
  onExportMarkdown,
  onExportText
}: ChatViewProps) {
  const { t } = useI18n();
  const [topic, setTopic] = useState("");
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const selectedRoles = room.roleIds
    .map((roleId) => roles.find((role) => role.id === roleId))
    .filter((role): role is AgentRole => Boolean(role));
  const enabledSelectedRoles = selectedRoles.filter((role) => role.enabled);
  const speakingRole = roles.find((role) => role.id === speakingRoleId);
  const visibleProviders = useMemo(() => providers.slice(0, 4), [providers]);

  useEffect(() => {
    if (room.messages.length > 0) {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [room.messages.length, room.messages.at(-1)?.content]);

  const setRounds = (value: number) => {
    onUpdateRoom({
      ...room,
      defaultRounds: clampRounds(value)
    });
  };

  const toggleRole = (roleId: string) => {
    const nextIds = room.roleIds.includes(roleId)
      ? room.roleIds.filter((item) => item !== roleId)
      : [...room.roleIds, roleId];

    onUpdateRoom({
      ...room,
      roleIds: nextIds
    });
  };

  const startDiscussion = () => {
    const trimmed = topic.trim();
    if (!trimmed) {
      window.alert(t("alertNeedTopic"));
      return;
    }

    onStart(trimmed, room.defaultRounds);
    setTopic("");
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="app-surface flex min-h-0 flex-col overflow-hidden rounded-[28px]">
        <header className="border-b border-slate-100 px-5 py-5 md:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <h2 className="truncate text-xl font-semibold tracking-[-0.01em] text-slate-950">{room.name}</h2>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                  {enabledSelectedRoles.length > 0 ? t("enabledRoleCount", { count: enabledSelectedRoles.length }) : t("noSpeakingRoles")}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1">{t("roundUnit", { count: room.defaultRounds })}</span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{t("localSave")}</span>
                {speakingRole ? (
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">{t("roleSpeaking", { name: speakingRole.name }).replace(/^[，,]\s?/, "")}</span>
                ) : null}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-500">
              {t("discussionRounds")}
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
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
            </label>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {roles.length === 0 ? (
              <span className="text-sm text-slate-500">{t("noRolesCreateFirst")}</span>
            ) : (
              roles.map((role) => {
                const checked = room.roleIds.includes(role.id);
                return (
                  <button
                    key={role.id}
                    className={cn(
                      "flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm transition",
                      checked ? "border-indigo-100 bg-indigo-50 text-indigo-900" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                      !role.enabled ? "opacity-50" : ""
                    )}
                    onClick={() => toggleRole(role.id)}
                    disabled={isRunning}
                    title={role.enabled ? role.name : `${role.name} ${t("disabled")}`}
                  >
                    <RoleAvatar role={role} size="xs" />
                    {role.name}
                  </button>
                );
              })
            )}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-white scrollbar-thin">
          {providers.length === 0 ? (
            <div className="mx-auto mt-5 max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {t("noProviderNotice")}
            </div>
          ) : null}
          {room.messages.length === 0 ? (
            <div className="flex min-h-full items-center justify-center px-6 text-center">
              <div>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50 text-indigo-600 shadow-sm">
                  <Bot className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-950">{t("emptyChatTitle")}</h3>
                <p className="mt-2 text-sm text-slate-500">{t("emptyChatDesc")}</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-5xl py-4">
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

        <footer className="border-t border-slate-100 bg-white px-5 py-5 md:px-7">
          <div className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_16px_44px_rgba(15,23,42,0.07)]">
            <textarea
              className="min-h-20 w-full resize-none rounded-2xl border-0 bg-transparent px-2 py-2 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 disabled:bg-slate-50"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder={t("topicPlaceholder")}
              disabled={isRunning}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  startDiscussion();
                }
              }}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="h-9 rounded-xl px-3"
                  variant="ghost"
                  title={t("copyCurrentChat")}
                  disabled={room.messages.length === 0}
                  onClick={() => {
                    const text = room.messages.map((message) => `${message.roleName}：${message.content}`).join("\n\n");
                    void navigator.clipboard?.writeText(text);
                  }}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button variant="secondary" onClick={() => onContinue(1)} disabled={isRunning || room.messages.length === 0}>
                  <RotateCcw className="h-4 w-4" />
                  {t("continueRound")}
                </Button>
                <Button variant="secondary" onClick={onSummarize} disabled={isRunning || room.messages.length === 0}>
                  <Sparkles className="h-4 w-4" />
                  {t("generateSummary")}
                </Button>
                <Button variant="secondary" onClick={onClear} disabled={isRunning || room.messages.length === 0}>
                  <Trash2 className="h-4 w-4" />
                  {t("clear")}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <Button variant="danger" onClick={onStop}>
                    <Square className="h-4 w-4" />
                    {t("stop")}
                  </Button>
                ) : (
                  <Button variant="primary" onClick={startDiscussion} disabled={isRunning}>
                    <Play className="h-4 w-4" />
                    {t("startDiscussion")}
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </footer>
      </section>

      <aside className="app-surface hidden min-h-0 flex-col overflow-hidden rounded-[28px] lg:flex">
        <div className="border-b border-slate-100 px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-slate-950">{t("roundtableContext")}</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
              {t("messagesCountShort", { count: room.messages.length })}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
          <ContextCard title={t("activeRoles")}>
            {selectedRoles.length === 0 ? (
              <p className="text-sm text-slate-500">{t("noParticipantsContext")}</p>
            ) : (
              <div className="space-y-2">
                {selectedRoles.map((role) => (
                  <div key={role.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <RoleAvatar role={role} size="xs" />
                      <span className="truncate text-sm font-medium text-slate-800">{role.name}</span>
                    </div>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px]", role.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400")}>
                      {role.enabled ? t("enabled") : t("disabled")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ContextCard>

          <ContextCard title={t("providerConfigs")}>
            {visibleProviders.length === 0 ? (
              <p className="text-sm text-slate-500">{t("noProvidersContext")}</p>
            ) : (
              <div className="space-y-2">
                {visibleProviders.map((provider) => {
                  const ready = Boolean(provider.baseUrl && provider.apiKey);
                  return (
                    <div key={provider.id} className="rounded-2xl bg-white px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium text-slate-800">{provider.name}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px]", ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                          {ready ? t("available") : t("unavailable")}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-400">{provider.defaultModel || t("useProviderDefault")}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </ContextCard>

          <ContextCard title={t("exportFormats")}>
            <div className="grid grid-cols-3 gap-2">
              <button
                className="rounded-2xl border border-slate-200 bg-white px-2 py-3 text-xs font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 disabled:opacity-50"
                onClick={onExportMarkdown}
                disabled={room.messages.length === 0}
              >
                <FileText className="mx-auto mb-1 h-4 w-4" />
                {t("formatMarkdown")}
              </button>
              <button
                className="rounded-2xl border border-slate-200 bg-white px-2 py-3 text-xs font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 disabled:opacity-50"
                onClick={onExportJson}
                disabled={room.messages.length === 0}
              >
                <FileJson className="mx-auto mb-1 h-4 w-4" />
                {t("formatJson")}
              </button>
              <button
                className="rounded-2xl border border-slate-200 bg-white px-2 py-3 text-xs font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 disabled:opacity-50"
                onClick={onExportText}
                disabled={room.messages.length === 0}
              >
                <FileText className="mx-auto mb-1 h-4 w-4" />
                {t("formatTxt")}
              </button>
            </div>
          </ContextCard>

          <ContextCard title={t("defaultRounds")}>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
                <span className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-indigo-500" />
                  {t("discussionRounds")}
                </span>
                <span className="font-semibold text-slate-900">{t("roundUnit", { count: room.defaultRounds })}</span>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {t("speakingOrder")}
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2">
                <Users className="h-4 w-4 text-indigo-500" />
                {t("enabledRoleCount", { count: enabledSelectedRoles.length })}
              </div>
            </div>
          </ContextCard>
        </div>
      </aside>
    </div>
  );
}
