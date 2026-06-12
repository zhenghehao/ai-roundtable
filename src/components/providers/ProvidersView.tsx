"use client";

import {
  CheckCircle2,
  Edit3,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Trash2,
  XCircle
} from "lucide-react";
import { useState } from "react";
import { ProviderForm } from "@/components/providers/ProviderForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n-context";
import type { LocalAgentDetection, ProviderConfig } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

interface ProvidersViewProps {
  providers: ProviderConfig[];
  onSave: (provider: ProviderConfig) => void;
  onDelete: (providerId: string) => void;
  onTest: (provider: ProviderConfig) => void;
  testingProviderId?: string;
  localAgentDetections: LocalAgentDetection[];
  detectingLocalAgents?: boolean;
  onDetectLocalAgents: () => void;
}

export function ProvidersView({
  providers,
  onSave,
  onDelete,
  onTest,
  testingProviderId,
  localAgentDetections,
  detectingLocalAgents,
  onDetectLocalAgents
}: ProvidersViewProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<ProviderConfig | undefined>();
  const [open, setOpen] = useState(false);
  const detectionById = new Map(localAgentDetections.map((detection) => [detection.id, detection]));

  const closeModal = () => {
    setOpen(false);
    setEditing(undefined);
  };

  return (
    <div className="app-surface mx-auto flex h-full max-w-6xl flex-col overflow-y-auto rounded-[18px] px-5 py-6 scrollbar-thin md:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-5">
        <div>
          <p className="workspace-description mb-1 text-[10px] font-semibold uppercase tracking-[0.18em]">{t("workspace")}</p>
          <h2 className="workspace-title page-heading text-2xl font-semibold">{t("providersTitle")}</h2>
          <p className="workspace-description mt-1.5 text-sm">{t("providersDesc")}</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditing(undefined);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {t("newProvider")}
        </Button>
      </div>

      <div className="mt-5 rounded-[14px] border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent-strong)]">
              <Terminal className="h-4 w-4" />
              本地 CLI 智能体
            </div>
            <p className="card-copy mt-1 text-sm leading-6">
              “已检测”表示电脑里存在该命令；只有“已适配”的 CLI 才能被角色选中并参加圆桌。
            </p>
          </div>
          <Button size="sm" onClick={onDetectLocalAgents} disabled={detectingLocalAgents}>
            <RefreshCw className={`h-4 w-4 ${detectingLocalAgents ? "animate-spin" : ""}`} />
            重新检测
          </Button>
        </div>
      </div>

      {providers.length === 0 ? (
        <div className="mt-10 flex min-h-80 items-center justify-center rounded-[14px] border border-dashed border-[var(--line-strong)] bg-[var(--surface-strong)] px-6 text-center">
          <div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--accent-soft)] text-[var(--accent)]">
              <KeyRound className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-950">{t("noProvidersTitle")}</h3>
            <p className="mt-2 text-sm text-gray-500">{t("noProvidersDesc")}</p>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-2.5">
          {providers.map((provider) => {
            const detection = provider.protocol === "local-cli" ? detectionById.get(provider.id) : undefined;
            const isDetectOnly = provider.localCli?.capability === "detect-only";

            return (
              <div key={provider.id} className="content-card rounded-[14px] p-4 transition hover:border-[#c8c7c1]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="card-title truncate text-[15px] font-semibold">{provider.name}</h3>
                    <span className="rounded-[6px] bg-[var(--surface-muted)] px-2 py-1 text-[10px] font-medium text-[var(--muted)]">
                      {provider.protocol === "anthropic"
                        ? t("protocolAnthropic")
                        : provider.protocol === "local-cli"
                          ? "本地 CLI"
                          : t("protocolOpenAI")}
                    </span>
                    {provider.protocol === "local-cli" ? (
                      <span
                        className={`rounded-[6px] px-2 py-1 text-[10px] font-medium ${
                          isDetectOnly ? "bg-amber-50 text-amber-700" : "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                        }`}
                      >
                        {isDetectOnly ? "仅检测" : "已适配"}
                      </span>
                    ) : null}
                    {provider.protocol === "local-cli" && detection?.installed ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        已安装
                      </span>
                    ) : null}
                    {provider.protocol === "local-cli" && detection && !detection.installed && detection.configured ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">
                        <XCircle className="h-3.5 w-3.5" />
                        发现配置，CLI 未安装
                      </span>
                    ) : null}
                    {provider.protocol === "local-cli" && detection && !detection.installed && !detection.configured ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
                        <XCircle className="h-3.5 w-3.5" />
                        未检测到
                      </span>
                    ) : null}
                    {provider.lastTestStatus === "success" ? <span className="text-[10px] font-medium text-emerald-700">测试成功</span> : null}
                    {provider.lastTestStatus === "failed" ? <span className="text-[10px] font-medium text-rose-700">测试失败</span> : null}
                  </div>
                  {provider.protocol === "local-cli" ? (
                    <>
                      <p className="card-copy mt-2 break-all font-mono text-xs">
                        {detection?.path || provider.localCli?.commandCandidates.join(" / ") || "未填写 CLI 命令"}
                      </p>
                      <p className="card-copy mt-1 text-xs">
                        {provider.defaultModel ? `模型：${provider.defaultModel}` : "使用 CLI 当前默认模型"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="card-copy mt-2 break-all font-mono text-xs">{provider.baseUrl || t("baseUrlMissing")}</p>
                      <p className="card-copy mt-1 text-xs">{t("defaultModelLabel", { model: provider.defaultModel || t("notFilled") })}</p>
                    </>
                  )}
                  {provider.note ? <p className="card-copy mt-3 text-xs leading-5">{provider.note}</p> : null}
                  <p className="card-copy mt-2 text-[10px]">{t("updatedAt", { time: formatDateTime(provider.updatedAt) })}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    title={isDetectOnly ? "当前仅支持检测" : "测试连接"}
                    disabled={
                      testingProviderId === provider.id ||
                      isDetectOnly ||
                      (provider.protocol === "local-cli" && !detection?.installed)
                    }
                    onClick={() => onTest(provider)}
                  >
                    {testingProviderId === provider.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    测试连接
                  </Button>
                  <Button
                    size="icon"
                    title={t("edit")}
                    onClick={() => {
                      setEditing(provider);
                      setOpen(true);
                    }}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    title={t("delete")}
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(t("confirmDeleteProvider", { name: provider.name }))) {
                        onDelete(provider.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal title={editing ? t("editProvider") : t("newProvider")} open={open} onClose={closeModal}>
        <ProviderForm
          provider={editing}
          onSave={(provider) => {
            onSave(provider);
            closeModal();
          }}
          onCancel={closeModal}
        />
      </Modal>
    </div>
  );
}
