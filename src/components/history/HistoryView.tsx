"use client";

import { Download, FileJson, FileText, Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n-context";
import type { ChatRoom } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

interface HistoryViewProps {
  room: ChatRoom;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  onExportText: () => void;
  onImportJson: (content: string) => void;
}

export function HistoryView({ room, onExportJson, onExportMarkdown, onExportText, onImportJson }: HistoryViewProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (file?: File) => {
    if (!file) {
      return;
    }

    const content = await file.text();
    onImportJson(content);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="app-surface mx-auto flex h-full max-w-6xl flex-col rounded-[18px] px-5 py-6 md:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-5">
        <div>
          <p className="workspace-description mb-1 text-[10px] font-semibold uppercase tracking-[0.18em]">{t("workspace")}</p>
          <h2 className="workspace-title page-heading text-2xl font-semibold">{t("historyTitle")}</h2>
          <p className="workspace-description mt-1.5 text-sm">{t("currentRoom", { name: room.name })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onExportJson} disabled={room.messages.length === 0}>
            <FileJson className="h-4 w-4" />
            {t("exportJson")}
          </Button>
          <Button onClick={onExportMarkdown} disabled={room.messages.length === 0}>
            <FileText className="h-4 w-4" />
            {t("exportMarkdown")}
          </Button>
          <Button onClick={onExportText} disabled={room.messages.length === 0}>
            <FileText className="h-4 w-4" />
            {t("exportText")}
          </Button>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            {t("importJson")}
          </Button>
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="content-card rounded-[14px] p-4">
          <div className="card-copy text-xs font-medium">{t("messageCount")}</div>
          <div className="card-title mt-2 text-3xl font-semibold tracking-[-0.04em]">{room.messages.length}</div>
        </div>
        <div className="content-card rounded-[14px] p-4">
          <div className="card-copy text-xs font-medium">{t("createdAt")}</div>
          <div className="card-title mt-2 text-base font-semibold">{formatDateTime(room.createdAt)}</div>
        </div>
        <div className="content-card rounded-[14px] p-4">
          <div className="card-copy text-xs font-medium">{t("updatedAt", { time: "" }).trim()}</div>
          <div className="card-title mt-2 text-base font-semibold">{formatDateTime(room.updatedAt)}</div>
        </div>
      </div>

      <div className="history-list mt-4 min-h-0 flex-1 overflow-y-auto rounded-[14px] border scrollbar-thin">
        {room.messages.length === 0 ? (
          <div className="flex min-h-72 items-center justify-center px-6 text-center text-sm text-gray-500">
            {t("noHistory")}
          </div>
        ) : (
          <div className="divide-y divide-[var(--line-soft)]">
            {room.messages.map((message) => (
              <div key={message.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-gray-950">{message.roleName}</div>
                  <div className="text-xs text-gray-400">{formatDateTime(message.createdAt)}</div>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">{message.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-[10px] border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-3 text-sm leading-6 text-[var(--accent-strong)]">
        <Download className="mt-0.5 h-4 w-4 shrink-0" />
        {t("exportHint")}
      </div>
    </div>
  );
}
