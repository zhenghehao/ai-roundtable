"use client";

import { BookOpen, FolderOpen, Languages, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select, TextInput } from "@/components/ui/Field";
import { useI18n } from "@/lib/i18n-context";
import { getLanguageOption, languageOptions } from "@/lib/languages";
import type { KnowledgeBaseSettings, LanguageCode } from "@/lib/types";

interface SettingsViewProps {
  language: LanguageCode;
  knowledgeBase: KnowledgeBaseSettings;
  isDesktopApp: boolean;
  onLanguageChange: (language: LanguageCode) => void;
  onKnowledgeBaseChange: (knowledgeBase: KnowledgeBaseSettings) => void;
  onSelectKnowledgeBase: () => void;
  onTestKnowledgeBase: () => void;
  onReset: () => void;
}

export function SettingsView({
  language,
  knowledgeBase,
  isDesktopApp,
  onLanguageChange,
  onKnowledgeBaseChange,
  onSelectKnowledgeBase,
  onTestKnowledgeBase,
  onReset
}: SettingsViewProps) {
  const { t } = useI18n();
  const currentLanguage = getLanguageOption(language);
  const updateKnowledgeBase = (patch: Partial<KnowledgeBaseSettings>) => {
    onKnowledgeBaseChange({
      ...knowledgeBase,
      ...patch
    });
  };

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
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-950">Obsidian 知识库</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    讨论开始前按话题检索本地 Markdown 笔记，把相关摘录加入圆桌上下文。
                  </p>
                </div>
                <label className="flex items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--ink-soft)]">
                  <input
                    type="checkbox"
                    checked={knowledgeBase.enabled}
                    disabled={!isDesktopApp || !knowledgeBase.vaultPath}
                    className="h-4 w-4 accent-[var(--accent)]"
                    onChange={(event) => updateKnowledgeBase({ enabled: event.target.checked })}
                  />
                  自动检索
                </label>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_140px_170px]">
                <div className="min-w-0">
                  <div className="mb-1.5 text-xs font-medium text-[var(--muted)]">知识库路径</div>
                  <div className="flex min-h-10 items-center rounded-[10px] border border-[var(--line)] bg-[var(--surface-muted)] px-3 font-mono text-xs text-[var(--muted)]">
                    <span className="truncate">
                      {knowledgeBase.vaultPath || (isDesktopApp ? "尚未选择 Obsidian vault" : "需要桌面版读取本地目录")}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-[var(--muted)]">笔记数量</div>
                  <TextInput
                    type="number"
                    min={1}
                    max={12}
                    value={knowledgeBase.maxNotes}
                    disabled={!isDesktopApp}
                    onChange={(event) => updateKnowledgeBase({ maxNotes: Number(event.target.value) || 5 })}
                  />
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-[var(--muted)]">每篇摘录字数</div>
                  <TextInput
                    type="number"
                    min={600}
                    max={8000}
                    step={200}
                    value={knowledgeBase.maxCharsPerNote}
                    disabled={!isDesktopApp}
                    onChange={(event) => updateKnowledgeBase({ maxCharsPerNote: Number(event.target.value) || 2400 })}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={onSelectKnowledgeBase} disabled={!isDesktopApp}>
                  <FolderOpen className="h-4 w-4" />
                  选择知识库
                </Button>
                <Button size="sm" variant="secondary" onClick={onTestKnowledgeBase} disabled={!isDesktopApp || !knowledgeBase.vaultPath}>
                  <Search className="h-4 w-4" />
                  测试检索
                </Button>
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
