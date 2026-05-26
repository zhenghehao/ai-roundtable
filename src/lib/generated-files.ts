export type GeneratedFileType = "txt" | "md" | "csv" | "html" | "docx" | "xlsx";

export interface GeneratedFileBlock {
  id: string;
  name: string;
  type: GeneratedFileType;
  content: string;
  font?: string;
  titleSize?: number;
  headingSize?: number;
  bodySize?: number;
}

const supportedTypes = new Set<GeneratedFileType>(["txt", "md", "csv", "html", "docx", "xlsx"]);
const fileBlockPattern = /<file\b([^>]*)>([\s\S]*?)<\/file>/gi;

function getAttribute(value: string, key: string) {
  const match = value.match(new RegExp(`${key}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1]?.trim();
}

function extensionFromName(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1];
}

function normalizeFileType(value?: string): GeneratedFileType | undefined {
  const normalized = value?.trim().replace(/^\./, "").toLowerCase();
  return normalized && supportedTypes.has(normalized as GeneratedFileType) ? (normalized as GeneratedFileType) : undefined;
}

function sanitizeFileName(name: string, type: GeneratedFileType) {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, "-").trim() || `AI圆桌输出.${type}`;
  return extensionFromName(cleaned) ? cleaned : `${cleaned}.${type}`;
}

function parsePointSize(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 8 && parsed <= 72 ? parsed : fallback;
}

export function stripGeneratedFileBlocks(content: string) {
  return content.replace(fileBlockPattern, "").trim();
}

export function parseGeneratedFileBlocks(content: string): GeneratedFileBlock[] {
  return Array.from(content.matchAll(fileBlockPattern))
    .map((match, index) => {
      const attributes = match[1] || "";
      const rawContent = (match[2] || "").trim();
      const rawName = getAttribute(attributes, "name") || getAttribute(attributes, "filename") || `AI圆桌输出-${index + 1}`;
      const type = normalizeFileType(getAttribute(attributes, "type")) || normalizeFileType(extensionFromName(rawName));

      if (!type || !rawContent) {
        return undefined;
      }

      const file: GeneratedFileBlock = {
        id: `generated-file-block-${index}-${rawName}`,
        name: sanitizeFileName(rawName, type),
        type,
        content: rawContent,
        font: getAttribute(attributes, "font") || "Microsoft YaHei",
        titleSize: parsePointSize(getAttribute(attributes, "title-size"), 24),
        headingSize: parsePointSize(getAttribute(attributes, "heading-size"), 16),
        bodySize: parsePointSize(getAttribute(attributes, "body-size"), 11)
      };

      return file;
    })
    .filter((file): file is GeneratedFileBlock => Boolean(file));
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function csvToRows(value: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((item) => item.some((cellValue) => cellValue.trim()));
}

function columnName(index: number) {
  let value = "";
  let current = index + 1;

  while (current > 0) {
    const mod = (current - 1) % 26;
    value = String.fromCharCode(65 + mod) + value;
    current = Math.floor((current - mod) / 26);
  }

  return value;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function dateToDos(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function concatBytes(chunks: Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function createZip(files: Array<{ path: string; content: string }>) {
  const encoder = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  const { time, day } = dateToDos();
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const contentBytes = encoder.encode(file.content);
    const checksum = crc32(contentBytes);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, day, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, contentBytes.length, true);
    localView.setUint32(22, contentBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);

    localChunks.push(localHeader, contentBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, day, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, contentBytes.length, true);
    centralView.setUint32(24, contentBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralChunks.push(centralHeader);
    offset += localHeader.length + contentBytes.length;
  }

  const centralDirectory = concatBytes(centralChunks);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, offset, true);

  return new Blob([concatBytes([...localChunks, centralDirectory, end])], { type: "application/zip" });
}

function runProperties(font: string, size: number, bold = false) {
  const halfPoints = Math.round(size * 2);
  return [
    "<w:rPr>",
    bold ? "<w:b/>" : "",
    `<w:rFonts w:ascii="${escapeXml(font)}" w:eastAsia="${escapeXml(font)}" w:hAnsi="${escapeXml(font)}"/>`,
    `<w:sz w:val="${halfPoints}"/>`,
    `<w:szCs w:val="${halfPoints}"/>`,
    "</w:rPr>"
  ].join("");
}

function createDocxBlob(file: GeneratedFileBlock) {
  const font = file.font || "Microsoft YaHei";
  const titleSize = file.titleSize || 24;
  const headingSize = file.headingSize || 16;
  const bodySize = file.bodySize || 11;
  const lines = file.content.split(/\n/);
  const paragraphs = lines
    .map((rawLine) => {
      const line = rawLine.trimEnd();
      const titleMatch = line.match(/^#\s+(.+)$/);
      const headingMatch = line.match(/^##\s+(.+)$/);
      const text = titleMatch?.[1] || headingMatch?.[1] || line;
      const size = titleMatch ? titleSize : headingMatch ? headingSize : bodySize;
      const bold = Boolean(titleMatch || headingMatch);
      const spacing = titleMatch ? '<w:spacing w:after="240"/>' : headingMatch ? '<w:spacing w:before="180" w:after="120"/>' : "";

      if (!text.trim()) {
        return "<w:p/>";
      }

      return `<w:p><w:pPr>${spacing}</w:pPr><w:r>${runProperties(font, size, bold)}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
    })
    .join("");

  return createZip([
    {
      path: "[Content_Types].xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        "</Types>"
    },
    {
      path: "_rels/.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        "</Relationships>"
    },
    {
      path: "word/document.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
        paragraphs +
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>'
    }
  ]);
}

function createXlsxBlob(content: string) {
  const rows = csvToRows(content);
  const sheetData = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, cellIndex) => {
          const ref = `${columnName(cellIndex)}${rowIndex + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return createZip([
    {
      path: "[Content_Types].xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        "</Types>"
    },
    {
      path: "_rels/.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>"
    },
    {
      path: "xl/workbook.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        "</Relationships>"
    },
    {
      path: "xl/worksheets/sheet1.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
        sheetData +
        "</sheetData></worksheet>"
    }
  ]);
}

export function createGeneratedFileBlob(file: GeneratedFileBlock) {
  if (file.type === "docx") {
    return createDocxBlob(file);
  }

  if (file.type === "xlsx") {
    return createXlsxBlob(file.content);
  }

  const mimeTypes: Record<GeneratedFileType, string> = {
    txt: "text/plain;charset=utf-8",
    md: "text/markdown;charset=utf-8",
    csv: "text/csv;charset=utf-8",
    html: "text/html;charset=utf-8",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  };

  return new Blob([file.content], { type: mimeTypes[file.type] });
}

export function downloadGeneratedFile(file: GeneratedFileBlock) {
  const blob = createGeneratedFileBlob(file);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
