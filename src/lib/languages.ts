import type { LanguageCode } from "@/lib/types";

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  promptName: string;
}

export const defaultLanguageCode: LanguageCode = "zh-Hans";

export const languageOptions: LanguageOption[] = [
  { code: "en", label: "英语（English）", promptName: "English" },
  { code: "zh-Hans", label: "中文（简体）", promptName: "Simplified Chinese" },
  { code: "zh-Hant", label: "中文（繁体）", promptName: "Traditional Chinese" },
  { code: "ja", label: "日语（Japanese）", promptName: "Japanese" },
  { code: "es", label: "西班牙语（Spanish）", promptName: "Spanish" },
  { code: "fr", label: "法语（French）", promptName: "French" },
  { code: "de", label: "德语（German）", promptName: "German" },
  { code: "pt", label: "葡萄牙语（Portuguese）", promptName: "Portuguese" },
  { code: "ru", label: "俄语（Russian）", promptName: "Russian" },
  { code: "ar", label: "阿拉伯语（Arabic）", promptName: "Arabic" },
  { code: "ko", label: "韩语（Korean）", promptName: "Korean" },
  { code: "it", label: "意大利语（Italian）", promptName: "Italian" },
  { code: "nl", label: "荷兰语（Dutch）", promptName: "Dutch" }
];

export function getLanguageOption(code: LanguageCode) {
  return languageOptions.find((language) => language.code === code) || languageOptions[1];
}

export function getLanguageInstruction(code: LanguageCode) {
  const language = getLanguageOption(code);

  if (code === "zh-Hans") {
    return "输出语言：请使用中文（简体）发言。";
  }

  if (code === "zh-Hant") {
    return "輸出語言：請使用中文（繁體）發言。";
  }

  return `Output language: Please write the main response in ${language.promptName}. Keep role names, product names, quoted user text, and API/model names unchanged when needed.`;
}
