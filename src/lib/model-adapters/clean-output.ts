const THINKING_BLOCK_PATTERN = /<(think|thinking|analysis)[^>]*>[\s\S]*?<\/\1>/gi;
const THINKING_TAG_PATTERN = /<\/?(think|thinking|analysis)[^>]*>/gi;

function stripMarkdownMarkers(line: string) {
  return line
    .replace(/^\s{0,3}#{1,6}\s+/g, "")
    .replace(/^\s{0,3}>\s?/g, "")
    .replace(/^\s{0,3}[-*+]\s+/g, "")
    .replace(/^\s{0,3}\d+[.)、]\s+/g, "")
    .replace(/^\s{0,3}-{3,}\s*$/g, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1");
}

export function cleanModelOutput(content: string) {
  return content
    .replace(THINKING_BLOCK_PATTERN, "")
    .replace(THINKING_TAG_PATTERN, "")
    .replace(/```[\s\S]*?```/g, (block) =>
      block
        .replace(/```[a-zA-Z0-9_-]*\n?/g, "")
        .replace(/```/g, "")
        .trim()
    )
    .split("\n")
    .map(stripMarkdownMarkers)
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
