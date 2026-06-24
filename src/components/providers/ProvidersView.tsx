"use client";

import {
  CheckCircle2,
  ChevronDown,
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
import type { Translator } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n-context";
import type { LocalAgentDetection, LocalAgentModelCatalog, ProviderConfig } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

interface ProvidersViewProps {
  providers: ProviderConfig[];
  onSave: (provider: ProviderConfig) => void;
  onDelete: (providerId: string) => void;
  onTest: (provider: ProviderConfig) => void;
  testingProviderId?: string;
  localAgentDetections: LocalAgentDetection[];
  localAgentModelCatalogs: LocalAgentModelCatalog[];
  detectingLocalAgents?: boolean;
  onDetectLocalAgents: () => void;
  onSelectLocalModel: (providerId: string, model: string) => void;
}

const modelSourceLabels: Record<LocalAgentModelCatalog["source"], string> = {
  cli: "CLI 实时返回",
  server: "本地服务",
  package: "CLI 内置模型定义",
  cache: "本机模型缓存",
  config: "本机配置",
  "built-in": "CLI 模型别名",
  configured: "圆桌配置",
  unavailable: "未读取"
};

function isLocalRuntimeProvider(provider: ProviderConfig) {
  return provider.protocol === "local-cli" || provider.protocol === "ollama" || Boolean(provider.localCli);
}

function protocolLabel(provider: ProviderConfig, t: Translator) {
  if (provider.protocol === "anthropic") {
    return t("protocolAnthropic");
  }
  if (provider.protocol === "local-cli") {
    return "本地 CLI";
  }
  if (provider.protocol === "ollama") {
    return "Ollama";
  }
  if (provider.localCli) {
    return "本地服务";
  }
  return t("protocolOpenAI");
}

export function ProvidersView({
  providers,
  onSave,
  onDelete,
  onTest,
  testingProviderId,
  localAgentDetections,
  localAgentModelCatalogs,
  detectingLocalAgents,
  onDetectLocalAgents,
  onSelectLocalModel
}: ProvidersViewProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<ProviderConfig | undefined>();
  const [open, setOpen] = useState(false);
  const detectionById = new Map(localAgentDetections.map((detection) => [detection.id, detection]));
  const modelCatalogById = new Map(localAgentModelCatalogs.map((catalog) => [catalog.id, catalog]));

  const closeModal = () => {
    setOpen(false);
    setEditing(undefined);
  };

  const selectLocalModel = (provider: ProviderConfig, value: string) => {
    if (value === "__custom__") {
      const customModel = window.prompt("请输入该 CLI 支持的模型名", provider.defaultModel)?.trim();
      if (customModel) {
        onSelectLocalModel(provider.id, customModel);
      }
      return;
    }

    onSelectLocalModel(provider.id, value);
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
              本地 AI / CLI 智能体
            </div>
            <p className="card-copy mt-1 text-sm leading-6">
              自动检测本机可调用的 CLI、本地模型服务和已下载模型。Ollama、LM Studio 需要本地服务启动后才能直接对话。
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
            const isLocalRuntime = isLocalRuntimeProvider(provider);
            const detection = isLocalRuntime ? detectionById.get(provider.id) : undefined;
            const modelCatalog = isLocalRuntime ? modelCatalogById.get(provider.id) : undefined;
            const isDetectOnly = provider.protocol === "local-cli" && provider.localCli?.capability === "detect-only";
            const modelOptions = Array.from(
              new Map(
                [
                  ...(provider.defaultModel ? [{ id: provider.defaultModel }] : []),
                  ...(modelCatalog?.currentModel ? [{ id: modelCatalog.currentModel }] : []),
                  ...(modelCatalog?.defaultModel ? [{ id: modelCatalog.defaultModel }] : []),
                  ...(modelCatalog?.models || [])
                ].map((model) => [model.id, model])
              ).values()
            );

            return (
              <div key={provider.id} className="content-card rounded-[14px] p-4 transition hover:border-[#c8c7c1]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="card-title truncate text-[15px] font-semibold">{provider.name}</h3>
                    <span className="rounded-[6px] bg-[var(--surface-muted)] px-2 py-1 text-[10px] font-medium text-[var(--muted)]">
                      {protocolLabel(provider, t)}
                    </span>
                    {isLocalRuntime ? (
                      <span
                        className={`rounded-[6px] px-2 py-1 text-[10px] font-medium ${
                          isDetectOnly ? "bg-amber-50 text-amber-700" : "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                        }`}
                      >
                        {isDetectOnly ? "仅检测" : "已适配"}
                      </span>
                    ) : null}
                    {isLocalRuntime && detection?.installed ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700" title={detection.message}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        已安装
                      </span>
                    ) : null}
                    {isLocalRuntime && detection && !detection.installed && detection.configured ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700" title={detection.message}>
                        <XCircle className="h-3.5 w-3.5" />
                        发现应用或配置，服务暂不可用
                      </span>
                    ) : null}
                    {isLocalRuntime && detection && !detection.installed && !detection.configured ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500" title={detection.message}>
                        <XCircle className="h-3.5 w-3.5" />
                        未检测到
                      </span>
                    ) : null}
                    {provider.lastTestStatus === "success" ? <span className="text-[10px] font-medium text-emerald-700">测试成功</span> : null}
                    {provider.lastTestStatus === "failed" ? <span className="text-[10px] font-medium text-rose-700">测试失败</span> : null}
                  </div>
                  {isLocalRuntime ? (
                    <>
                      <p className="card-copy mt-2 break-all font-mono text-xs">
                        {provider.protocol === "local-cli"
                          ? detection?.path || provider.localCli?.commandCandidates.join(" / ") || "未填写 CLI 命令"
                          : provider.baseUrl || detection?.path || "未填写本地服务地址"}
                      </p>
                      <p className="card-copy mt-1 text-xs">
                        {provider.defaultModel
                          ? `模型：${provider.defaultModel}`
                          : provider.protocol === "local-cli"
                            ? "使用 CLI 当前默认模型"
                            : "尚未选择默认模型"}
                      </p>
                      {detection?.installed ? (
                        <>
                          <p className="card-copy mt-1 text-xs" title={modelCatalog?.message}>
                            {modelCatalog?.models.length
                              ? `已读取 ${modelCatalog.models.length} 个模型 · 来源：${modelSourceLabels[modelCatalog.source]}`
                              : modelCatalog?.supportsSelection
                                ? "未读取到模型列表 · 支持手动输入切换"
                                : "当前运行时暂不支持模型切换"}
                            {modelCatalog?.currentModel ? ` · CLI 当前：${modelCatalog.currentModel}` : ""}
                          </p>
                          {!isDetectOnly && modelCatalog?.supportsSelection !== false ? (
                            <label className="mt-3 block max-w-md">
                              <span className="card-copy mb-1.5 block text-[11px] font-medium">圆桌默认模型</span>
                              <span className="relative block">
                                <select
                                  className="round-select h-10 w-full appearance-none rounded-[9px] border py-0 pl-3 pr-9 text-sm outline-none transition focus:ring-2"
                                  value={provider.defaultModel}
                                  onChange={(event) => selectLocalModel(provider, event.target.value)}
                                >
                                  <option value="">
                                    {modelCatalog?.defaultModel
                                      ? `跟随默认（${modelCatalog.defaultModel}）`
                                      : provider.protocol === "local-cli"
                                        ? "跟随 CLI 当前默认模型"
                                        : "不指定默认模型"}
                                  </option>
                                  {modelOptions.map((model) => (
                                    <option key={model.id} value={model.id}>
                                      {model.label && model.label !== model.id ? `${model.label} (${model.id})` : model.id}
                                    </option>
                                  ))}
                                  <option value="__custom__">手动输入模型名...</option>
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                              </span>
                              <span className="card-copy mt-1.5 block text-[10px]">
                                角色若单独指定了模型，会优先使用角色模型。
                              </span>
                            </label>
                          ) : null}
                        </>
                      ) : null}
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
                      || (provider.protocol === "ollama" && !provider.defaultModel)
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
