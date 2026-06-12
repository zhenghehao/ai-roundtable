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
    <div className="app-surface mx-auto flex h-full max-w-6xl flex-col overflow-y-auto rounded-[18px] px-5 py-6 scrollbar-thin md:px-7">
      <div className="border-b border-[var(--line)] pb-5">
        <p className="workspace-description mb-1 text-[10px] font-semibold uppercase tracking-[0.18em]">{t("workspace")}</p>
        <h2 className="workspace-title page-heading text-2xl font-semibold">{t("settings")}</h2>
        <p className="workspace-description mt-1.5 text-sm">{t("settingsDesc")}</p>
      </div>

      <div className="mt-5 grid gap-3">
        <section className="content-card rounded-[14px] p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[var(--accent-soft)] text-[var(--accent)]">
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

        <section className="content-card rounded-[14px] p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[var(--accent-soft)] text-[var(--accent)]">
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

        <section className="rounded-[14px] border border-[var(--danger-line)] bg-[var(--danger-surface)] p-5">
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
