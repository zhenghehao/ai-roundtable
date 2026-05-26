import type { ChatAttachment, ChatAttachmentKind } from "@/lib/types";
import { createId, nowIso } from "@/lib/utils";

export const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;
export const MAX_EXTRACTED_TEXT_CHARS = 60000;
export const MAX_MODEL_ATTACHMENT_CHARS = 24000;

export const ACCEPTED_CHAT_ATTACHMENT_TYPES = [
  ".pdf",
  ".docx",
  ".xlsx",
  ".pptx",
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".html",
  ".htm",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "image/png",
  "image/jpeg",
  "image/webp"
].join(",");

const textExtensions = new Set(["txt", "md", "markdown", "csv"]);
const imageExtensions = new Set(["png", "jpg", "jpeg", "webp"]);

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

export function isSupportedChatAttachment(file: File) {
  const extension = getExtension(file.name);
  return ["pdf", "docx", "xlsx", "pptx", "txt", "md", "markdown", "csv", "png", "jpg", "jpeg", "webp", "html", "htm"].includes(extension);
}

export function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function getAttachmentKind(fileName: string, mimeType: string): ChatAttachmentKind {
  const extension = getExtension(fileName);

  if (imageExtensions.has(extension) || mimeType.startsWith("image/")) {
    return "image";
  }

  if (extension === "pdf" || mimeType === "application/pdf") {
    return "pdf";
  }

  if (extension === "docx") {
    return "document";
  }

  if (extension === "xlsx") {
    return "spreadsheet";
  }

  if (extension === "pptx") {
    return "presentation";
  }

  if (extension === "html" || extension === "htm" || mimeType === "text/html") {
    return "html";
  }

  if (textExtensions.has(extension) || mimeType.startsWith("text/")) {
    return "text";
  }

  return "unknown";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("readDataUrlFailed"));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("readTextFailed"));
    reader.readAsText(file, "utf-8");
  });
}

function limitText(text: string, maxLength = MAX_EXTRACTED_TEXT_CHARS) {
  const clean = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  if (clean.length <= maxLength) {
    return clean;
  }

  return `${clean.slice(0, maxLength)}\n\n[内容过长，已截取前 ${maxLength} 字]`;
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function xmlTextContent(xml: string) {
  return limitText(
    decodeXmlEntities(
      xml
        .replace(/<w:tab\/>/g, "\t")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<\/a:p>/g, "\n")
        .replace(/<[^>]+>/g, " ")
    ).replace(/\s+\n/g, "\n")
  );
}

function htmlToText(html: string) {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return limitText(doc.body?.innerText || doc.body?.textContent || "");
  }

  return limitText(html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " "));
}

function readUint16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

async function inflateBytes(bytes: Uint8Array, format: "deflate" | "deflate-raw") {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("decompressionUnavailable");
  }

  const byteBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const stream = new Blob([byteBuffer]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function getZipTextEntries(buffer: ArrayBuffer, matcher: (name: string) => boolean) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder("utf-8");
  let eocdOffset = -1;
  const minOffset = Math.max(0, bytes.length - 65557);

  for (let offset = bytes.length - 22; offset >= minOffset; offset -= 1) {
    if (readUint32(view, offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) {
    throw new Error("zipDirectoryNotFound");
  }

  const totalEntries = readUint16(view, eocdOffset + 10);
  let centralOffset = readUint32(view, eocdOffset + 16);
  const entries: Array<{ name: string; text: string }> = [];

  for (let index = 0; index < totalEntries; index += 1) {
    if (readUint32(view, centralOffset) !== 0x02014b50) {
      break;
    }

    const method = readUint16(view, centralOffset + 10);
    const compressedSize = readUint32(view, centralOffset + 20);
    const nameLength = readUint16(view, centralOffset + 28);
    const extraLength = readUint16(view, centralOffset + 30);
    const commentLength = readUint16(view, centralOffset + 32);
    const localOffset = readUint32(view, centralOffset + 42);
    const name = decoder.decode(bytes.slice(centralOffset + 46, centralOffset + 46 + nameLength));

    if (matcher(name) && readUint32(view, localOffset) === 0x04034b50) {
      const localNameLength = readUint16(view, localOffset + 26);
      const localExtraLength = readUint16(view, localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      const inflated = method === 0 ? compressed : method === 8 ? await inflateBytes(compressed, "deflate-raw") : undefined;

      if (inflated) {
        entries.push({ name, text: decoder.decode(inflated) });
      }
    }

    centralOffset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

async function extractDocxText(buffer: ArrayBuffer) {
  const entries = await getZipTextEntries(buffer, (name) => name === "word/document.xml" || /^word\/(footnotes|endnotes)\.xml$/.test(name));
  return limitText(entries.map((entry) => xmlTextContent(entry.text)).filter(Boolean).join("\n\n"));
}

async function extractPptxText(buffer: ArrayBuffer) {
  const entries = await getZipTextEntries(buffer, (name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  return limitText(
    entries
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .map((entry, index) => `第 ${index + 1} 页\n${xmlTextContent(entry.text)}`)
      .join("\n\n")
  );
}

function extractXmlTagValues(xml: string, tagName: string) {
  return Array.from(xml.matchAll(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "g"))).map((match) =>
    decodeXmlEntities(match[1].replace(/<[^>]+>/g, ""))
  );
}

async function extractXlsxText(buffer: ArrayBuffer) {
  const entries = await getZipTextEntries(buffer, (name) => name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  const sharedStrings = entries.find((entry) => entry.name === "xl/sharedStrings.xml");
  const strings = sharedStrings ? extractXmlTagValues(sharedStrings.text, "t") : [];
  const sheets = entries.filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.name)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  return limitText(
    sheets
      .map((sheet, index) => {
        const rows = Array.from(sheet.text.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)).map((rowMatch) => {
          const cells = Array.from(rowMatch[1].matchAll(/<c([^>]*)>[\s\S]*?<v>([\s\S]*?)<\/v>[\s\S]*?<\/c>/g)).map((cellMatch) => {
            const rawValue = decodeXmlEntities(cellMatch[2]);
            return cellMatch[1].includes('t="s"') ? strings[Number(rawValue)] || rawValue : rawValue;
          });
          return cells.join("\t");
        });

        return `第 ${index + 1} 张表\n${rows.filter(Boolean).join("\n")}`;
      })
      .join("\n\n")
  );
}

function bytesToLatin1(bytes: Uint8Array) {
  let result = "";
  const chunkSize = 8192;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    result += String.fromCharCode(...bytes.slice(offset, offset + chunkSize));
  }
  return result;
}

function decodePdfLiteralString(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\([\\()])/g, "$1")
    .replace(/\\\d{1,3}/g, "");
}

function extractPdfStrings(source: string) {
  const textObjects = source.match(/BT[\s\S]*?ET/g) || [];
  const chunks: string[] = [];

  textObjects.forEach((objectText) => {
    Array.from(objectText.matchAll(/\((?:\\.|[^\\)])*\)/g)).forEach((match) => {
      chunks.push(decodePdfLiteralString(match[0].slice(1, -1)));
    });
  });

  return limitText(chunks.join(" ").replace(/\s{2,}/g, " "));
}

async function extractPdfText(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const binary = bytesToLatin1(bytes);
  const sources = [binary];
  let cursor = 0;

  while (cursor < binary.length) {
    const streamIndex = binary.indexOf("stream", cursor);
    if (streamIndex < 0) {
      break;
    }

    const endIndex = binary.indexOf("endstream", streamIndex);
    if (endIndex < 0) {
      break;
    }

    const dictionary = binary.slice(Math.max(0, streamIndex - 600), streamIndex);
    let dataStart = streamIndex + "stream".length;
    if (binary[dataStart] === "\r" && binary[dataStart + 1] === "\n") {
      dataStart += 2;
    } else if (binary[dataStart] === "\n" || binary[dataStart] === "\r") {
      dataStart += 1;
    }

    const dataEnd = binary[endIndex - 1] === "\n" || binary[endIndex - 1] === "\r" ? endIndex - 1 : endIndex;
    const streamBytes = bytes.slice(dataStart, dataEnd);

    if (dictionary.includes("/FlateDecode")) {
      try {
        sources.push(bytesToLatin1(await inflateBytes(streamBytes, "deflate")));
      } catch {
        // Best effort only. Some PDFs use filters or encodings that need a full PDF engine.
      }
    } else {
      sources.push(bytesToLatin1(streamBytes));
    }

    cursor = endIndex + "endstream".length;
  }

  const extracted = extractPdfStrings(sources.join("\n"));
  return extracted || "PDF 已上传。当前文件可能使用扫描图片、特殊字体或加密编码，无法在本地直接提取正文；模型仍可看到文件名和类型。";
}

async function extractText(file: File, kind: ChatAttachmentKind) {
  if (kind === "image") {
    return undefined;
  }

  if (kind === "text") {
    return limitText(await readFileAsText(file));
  }

  if (kind === "html") {
    return htmlToText(await readFileAsText(file));
  }

  const buffer = await file.arrayBuffer();

  if (kind === "pdf") {
    return extractPdfText(buffer);
  }

  if (kind === "document") {
    return extractDocxText(buffer);
  }

  if (kind === "spreadsheet") {
    return extractXlsxText(buffer);
  }

  if (kind === "presentation") {
    return extractPptxText(buffer);
  }

  return undefined;
}

export async function createChatAttachment(file: File): Promise<ChatAttachment> {
  const kind = getAttachmentKind(file.name, file.type);
  const dataUrl = await readFileAsDataUrl(file);

  try {
    const extractedText = await extractText(file, kind);

    return {
      id: createId("attachment"),
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      kind,
      dataUrl,
      extractedText,
      status: extractedText || kind === "image" ? "ready" : "partial",
      createdAt: nowIso()
    };
  } catch {
    return {
      id: createId("attachment"),
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      kind,
      dataUrl,
      status: "partial",
      error: "本地解析失败，模型将只能看到文件名和类型。",
      createdAt: nowIso()
    };
  }
}

export function formatAttachmentsForModel(attachments: ChatAttachment[] = []) {
  if (attachments.length === 0) {
    return "";
  }

  return attachments
    .map((attachment, index) => {
      const text = attachment.extractedText?.trim();
      const clippedText =
        text && text.length > MAX_MODEL_ATTACHMENT_CHARS
          ? `${text.slice(0, MAX_MODEL_ATTACHMENT_CHARS)}\n[附件内容过长，已截取前 ${MAX_MODEL_ATTACHMENT_CHARS} 字]`
          : text;

      return [
        `附件 ${index + 1}：${attachment.name}`,
        `类型：${attachment.kind} / ${attachment.mimeType || "未知类型"}，大小：${formatFileSize(attachment.size)}`,
        clippedText ? `可读取内容：\n${clippedText}` : "可读取内容：当前没有提取到文本。如果这是图片，支持视觉的模型可查看图片；如果是复杂文档，请结合文件名与用户说明回答。"
      ].join("\n");
    })
    .join("\n\n");
}
