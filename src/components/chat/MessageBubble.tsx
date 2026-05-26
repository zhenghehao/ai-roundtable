"use client";

import { Copy, Download, ExternalLink, FileText, ImageIcon, Loader2, Trash2 } from "lucide-react";
import { RoleAvatar } from "@/components/roles/RoleAvatar";
import { Button } from "@/components/ui/Button";
import { formatFileSize } from "@/lib/attachments";
import { downloadGeneratedFile, parseGeneratedFileBlocks, stripGeneratedFileBlocks, type GeneratedFileBlock } from "@/lib/generated-files";
import { useI18n } from "@/lib/i18n-context";
import type { AgentRole, ChatAttachment, ChatMessage } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";

interface MessageBubbleProps {
  message: ChatMessage;
  role?: AgentRole;
  onCopy: (message: ChatMessage) => void;
  onDelete: (messageId: string) => void;
}

interface GeneratedOutput {
  id: string;
  name: string;
  url: string;
  kind: "image" | "file";
}

const imageExtensionPattern = /\.(png|jpg|jpeg|webp|gif|svg)(\?|#|$)/i;
const fileExtensionPattern = /\.(pdf|docx|xlsx|pptx|txt|md|csv|html|zip)(\?|#|$)/i;
const markdownImageInlinePattern = /!\[[^\]]*\]\((https?:\/\/[^)]+|data:image\/[^)]+)\)/g;

function getFileNameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const name = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "");
    return name || "output";
  } catch {
    return url.startsWith("data:image/") ? "generated-image" : "generated-file";
  }
}

function isLikelyImageUrl(url: string) {
  if (/^data:image\//i.test(url) || imageExtensionPattern.test(url)) {
    return true;
  }

  try {
    const parsed = new URL(url);
    return parsed.hostname === "image.pollinations.ai" || (parsed.hostname.endsWith("pollinations.ai") && parsed.pathname.startsWith("/prompt/"));
  } catch {
    return false;
  }
}

function normalizeOutputUrl(url: string) {
  return url.trim().replace(/ /g, "%20");
}

function getGeneratedOutputs(content: string): GeneratedOutput[] {
  const outputs = new Map<string, GeneratedOutput>();
  const markdownImagePattern = /!\[([^\]]*)\]\((https?:\/\/[^)]+|data:image\/[^)]+)\)/g;
  const markdownLinkPattern = /(?<!!)\[([^\]]*)\]\((https?:\/\/[^)]+|data:[^)]+)\)/g;
  const plainUrlPattern = /(https?:\/\/[^\s)]+|data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+)/g;

  Array.from(content.matchAll(markdownImagePattern)).forEach((match, index) => {
    const alt = match[1]?.trim();
    const url = normalizeOutputUrl(match[2]);
    outputs.set(url, {
      id: `generated-image-${index}-${url.slice(0, 32)}`,
      name: alt || getFileNameFromUrl(url),
      url,
      kind: "image"
    });
  });

  Array.from(content.matchAll(markdownLinkPattern)).forEach((match, index) => {
    const label = match[1]?.trim();
    const url = normalizeOutputUrl(match[2]);

    if (!outputs.has(url) && (isLikelyImageUrl(url) || fileExtensionPattern.test(url))) {
      outputs.set(url, {
        id: `generated-link-${index}-${url.slice(0, 32)}`,
        name: label || getFileNameFromUrl(url),
        url,
        kind: isLikelyImageUrl(url) ? "image" : "file"
      });
    }
  });

  Array.from(content.matchAll(plainUrlPattern)).forEach((match, index) => {
    const url = match[1];

    if (!outputs.has(url) && (isLikelyImageUrl(url) || fileExtensionPattern.test(url))) {
      outputs.set(url, {
        id: `generated-url-${index}-${url.slice(0, 32)}`,
        name: getFileNameFromUrl(url),
        url,
        kind: isLikelyImageUrl(url) ? "image" : "file"
      });
    }
  });

  return Array.from(outputs.values());
}

function AttachmentCard({ attachment }: { attachment: ChatAttachment }) {
  const { t } = useI18n();
  const isImage = attachment.kind === "image" && attachment.dataUrl;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white/80 p-2 shadow-sm">
      <div className="flex items-center gap-3">
        {isImage ? (
          <img src={attachment.dataUrl} alt={attachment.name} className="h-12 w-12 rounded-xl object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-indigo-500">
            <FileText className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-slate-800">{attachment.name}</div>
          <div className="mt-0.5 text-[11px] text-slate-400">{formatFileSize(attachment.size)}</div>
        </div>
        {attachment.dataUrl ? (
          <a
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
            href={attachment.dataUrl}
            download={attachment.name}
            title={t("downloadAttachment")}
          >
            <Download className="h-4 w-4" />
          </a>
        ) : null}
      </div>
      {attachment.extractedText ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-indigo-600">{t("previewAttachment")}</summary>
          <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600 scrollbar-thin">
            {attachment.extractedText}
          </pre>
        </details>
      ) : attachment.error ? (
        <p className="mt-2 text-xs leading-5 text-amber-700">{attachment.error}</p>
      ) : null}
    </div>
  );
}

function GeneratedFileCard({ file }: { file: GeneratedFileBlock }) {
  const { t } = useI18n();

  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-slate-800">{file.name}</div>
          <div className="mt-0.5 text-[11px] uppercase text-slate-400">{file.type}</div>
        </div>
        <Button className="h-8 rounded-lg px-2 text-xs" size="sm" variant="secondary" onClick={() => downloadGeneratedFile(file)}>
          <Download className="h-3.5 w-3.5" />
          {t("downloadAttachment")}
        </Button>
      </div>
      {file.type === "txt" || file.type === "md" || file.type === "csv" || file.type === "html" ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-indigo-600">{t("previewAttachment")}</summary>
          <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600 scrollbar-thin">
            {file.content}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

export function MessageBubble({ message, role, onCopy, onDelete }: MessageBubbleProps) {
  const { t } = useI18n();
  const isUser = message.role === "user";
  const isSummary = message.role === "summary";
  const color = isSummary ? "#c2410c" : role?.avatarColor || "#6d5dfb";
  const generatedFiles = parseGeneratedFileBlocks(message.content);
  const contentWithoutFileBlocks = stripGeneratedFileBlocks(message.content);
  const generatedOutputs = getGeneratedOutputs(contentWithoutFileBlocks);
  const displayContent = generatedOutputs.some((output) => output.kind === "image")
    ? contentWithoutFileBlocks.replace(markdownImageInlinePattern, "").trim()
    : contentWithoutFileBlocks;

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
        {displayContent || message.error || message.status === "pending" ? (
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
            {displayContent}
            {message.error ? <div className="mt-2 text-xs opacity-80">{message.error}</div> : null}
          </div>
        ) : null}
        {message.attachments?.length ? (
          <div className="grid gap-2">
            {message.attachments.map((attachment) => (
              <AttachmentCard key={attachment.id} attachment={attachment} />
            ))}
          </div>
        ) : null}
        {generatedFiles.length > 0 || generatedOutputs.length > 0 ? (
          <div className="grid gap-2">
            <div className="text-xs font-medium text-slate-400">{t("generatedOutputs")}</div>
            {generatedFiles.map((file) => (
              <GeneratedFileCard key={file.id} file={file} />
            ))}
            {generatedOutputs.map((output) =>
              output.kind === "image" ? (
                <div key={output.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                  <img src={output.url} alt={output.name} className="max-h-72 w-full object-contain bg-slate-50" />
                  <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-slate-500">
                    <span className="truncate">{output.name}</span>
                    <a className="inline-flex items-center gap-1 text-indigo-600" href={output.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t("viewAttachment")}
                    </a>
                  </div>
                </div>
              ) : (
                <div key={output.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-indigo-500">
                    <FileText className="h-5 w-5" />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">{output.name}</span>
                  <a className="inline-flex items-center gap-1 text-xs text-indigo-600" href={output.url} target="_blank" rel="noreferrer">
                    <ImageIcon className="h-3.5 w-3.5" />
                    {t("viewAttachment")}
                  </a>
                  <a className="inline-flex items-center gap-1 text-xs text-indigo-600" href={output.url} download={output.name}>
                    <Download className="h-3.5 w-3.5" />
                    {t("downloadAttachment")}
                  </a>
                </div>
              )
            )}
          </div>
        ) : null}
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
