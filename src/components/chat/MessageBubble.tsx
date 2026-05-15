"use client";

import { Copy, Loader2, Trash2 } from "lucide-react";
import { RoleAvatar } from "@/components/roles/RoleAvatar";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n-context";
import type { AgentRole, ChatMessage } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";

interface MessageBubbleProps {
  message: ChatMessage;
  role?: AgentRole;
  onCopy: (message: ChatMessage) => void;
  onDelete: (messageId: string) => void;
}

export function MessageBubble({ message, role, onCopy, onDelete }: MessageBubbleProps) {
  const { t } = useI18n();
  const isUser = message.role === "user";
  const isSummary = message.role === "summary";
  const color = isSummary ? "#c2410c" : role?.avatarColor || "#6d5dfb";

  return (
    <div className={cn("group flex gap-3 px-4 py-4 md:px-6", isUser ? "justify-end" : "justify-start")}>
      {!isUser ? (
        <RoleAvatar role={role} fallbackName={message.roleName} color={color} size="sm" className="mt-7 shadow-sm" />
      ) : null}

      <div className={cn("max-w-[82%] space-y-1 md:max-w-[72%]", isUser ? "items-end" : "items-start")}>
        <div className={cn("flex items-center gap-2 text-xs text-slate-400", isUser ? "justify-end" : "justify-start")}>
          <span className="font-medium text-slate-500">{message.roleName}</span>
          <span>{formatTime(message.createdAt)}</span>
          {message.status === "pending" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" /> : null}
        </div>
        <div
          className={cn(
            "whitespace-pre-wrap break-words rounded-[22px] px-4 py-3 text-sm leading-7 shadow-sm",
            isUser
              ? "bg-slate-100 text-slate-900"
              : message.status === "error"
                ? "border border-rose-200 bg-rose-50 text-rose-900"
                : isSummary
                  ? "border border-amber-200 bg-amber-50 text-slate-900"
                  : "border border-slate-100 bg-white text-slate-900"
          )}
        >
          {message.content}
          {message.error ? <div className="mt-2 text-xs opacity-80">{message.error}</div> : null}
        </div>
        <div className={cn("flex gap-1 opacity-0 transition group-hover:opacity-100", isUser ? "justify-end" : "")}>
          <Button className="h-8 w-8 rounded-lg" size="icon" variant="ghost" title={t("copy")} onClick={() => onCopy(message)}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button className="h-8 w-8 rounded-lg" size="icon" variant="ghost" title={t("delete")} onClick={() => onDelete(message.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isUser ? (
        <div className="mt-7 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white shadow-sm">
          {t("me")}
        </div>
      ) : null}
    </div>
  );
}
