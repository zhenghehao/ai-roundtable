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
    <div className="app-surface mx-auto flex h-full max-w-6xl flex-col overflow-y-auto rounded-[28px] px-5 py-6 scrollbar-thin md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-semibold text-gray-950">{t("providersTitle")}</h2>
          <p className="mt-1 text-sm text-gray-500">{t("providersDesc")}</p>
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

      <div className="mt-5 rounded-3xl border border-indigo-100 bg-indigo-50/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-950">
              <Terminal className="h-4 w-4" />
              本地 CLI 智能体
            </div>
            <p className="mt-1 text-sm leading-6 text-indigo-700">
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
        <div className="mt-10 flex min-h-80 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white px-6 text-center">
          <div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <KeyRound className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-950">{t("noProvidersTitle")}</h3>
            <p className="mt-2 text-sm text-gray-500">{t("noProvidersDesc")}</p>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {providers.map((provider) => {
            const detection = provider.protocol === "local-cli" ? detectionById.get(provider.id) : undefined;
            const isDetectOnly = provider.localCli?.capability === "detect-only";

            return (
              <div key={provider.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-gray-950">{provider.name}</h3>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                      {provider.protocol === "anthropic"
                        ? t("protocolAnthropic")
                        : provider.protocol === "local-cli"
                          ? "本地 CLI"
                          : t("protocolOpenAI")}
                    </span>
                    {provider.protocol === "local-cli" ? (
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          isDetectOnly ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-indigo-700"
                        }`}
                      >
                        {isDetectOnly ? "仅检测" : "已适配"}
                      </span>
                    ) : null}
                    {provider.protocol === "local-cli" && detection?.installed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        已安装
                      </span>
                    ) : null}
                    {provider.protocol === "local-cli" && detection && !detection.installed && detection.configured ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">
                        <XCircle className="h-3.5 w-3.5" />
                        发现配置，CLI 未安装
                      </span>
                    ) : null}
                    {provider.protocol === "local-cli" && detection && !detection.installed && !detection.configured ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                        <XCircle className="h-3.5 w-3.5" />
                        未检测到
                      </span>
                    ) : null}
                    {provider.lastTestStatus === "success" ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">测试成功</span> : null}
                    {provider.lastTestStatus === "failed" ? <span className="rounded-full bg-rose-50 px-2 py-1 text-xs text-rose-700">测试失败</span> : null}
                  </div>
                  {provider.protocol === "local-cli" ? (
                    <>
                      <p className="mt-2 break-all text-sm text-gray-600">
                        {detection?.path || provider.localCli?.commandCandidates.join(" / ") || "未填写 CLI 命令"}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {provider.defaultModel ? `模型：${provider.defaultModel}` : "使用 CLI 当前默认模型"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 break-all text-sm text-gray-600">{provider.baseUrl || t("baseUrlMissing")}</p>
                      <p className="mt-1 text-sm text-gray-500">{t("defaultModelLabel", { model: provider.defaultModel || t("notFilled") })}</p>
                    </>
                  )}
                  {provider.note ? <p className="mt-3 text-sm text-gray-500">{provider.note}</p> : null}
                  <p className="mt-3 text-xs text-gray-400">{t("updatedAt", { time: formatDateTime(provider.updatedAt) })}</p>
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
