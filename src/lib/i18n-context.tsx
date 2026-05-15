"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, type Translator } from "@/lib/i18n";
import { defaultLanguageCode } from "@/lib/languages";
import type { LanguageCode } from "@/lib/types";

interface I18nContextValue {
  language: LanguageCode;
  t: Translator;
}

const I18nContext = createContext<I18nContextValue>({
  language: defaultLanguageCode,
  t: createTranslator(defaultLanguageCode)
});

export function I18nProvider({ language, children }: { language: LanguageCode; children: ReactNode }) {
  const value = useMemo(
    () => ({
      language,
      t: createTranslator(language)
    }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
