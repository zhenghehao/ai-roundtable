"use client";

import { Languages, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { useI18n } from "@/lib/i18n-context";
import { getLanguageOption, languageOptions } from "@/lib/languages";
import type { LanguageCode } from "@/lib/types";

interface SettingsViewProps {
  language: LanguageCode;
  onLanguageChange: (language: LanguageCode) => void;
  onReset: () => void;
}

export function SettingsView({ language, onLanguageChange, onReset }: SettingsViewProps) {
  const { t } = useI18n();
  const currentLanguage = getLanguageOption(language);

  return (
    <div className="app-surface mx-auto flex h-full max-w-6xl flex-col overflow-y-auto rounded-[28px] px-5 py-6 scrollbar-thin md:px-8">
      <div className="border-b border-slate-100 pb-5">
        <h2 className="text-xl font-semibold text-gray-950">{t("settings")}</h2>
        <p className="mt-1 text-sm text-gray-500">{t("settingsDesc")}</p>
      </div>

      <div className="mt-6 grid gap-4">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Languages className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-950">{t("language")}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    {t("currentLanguage", { language: currentLanguage.label })}
                  </p>
                </div>
                <div className="w-full md:w-72">
                  <Select value={language} onChange={(event) => onLanguageChange(event.target.value as LanguageCode)}>
                    {languageOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-950">{t("localSave")}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {t("localSaveDesc")}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-rose-100 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-950">{t("resetLocalData")}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{t("resetLocalDataDesc")}</p>
            </div>
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm(t("confirmResetData"))) {
                  onReset();
                }
              }}
            >
              <RotateCcw className="h-4 w-4" />
              {t("reset")}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
