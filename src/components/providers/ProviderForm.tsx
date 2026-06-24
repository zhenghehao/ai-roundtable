"use client";

import { useMemo, useState } from "react";
import { providerTemplates } from "@/lib/defaults";
import { useI18n } from "@/lib/i18n-context";
import type {
  LocalCliInputMode,
  LocalCliOutputFormat,
  ProviderConfig,
  ProviderProtocol
} from "@/lib/types";
import { createId, nowIso } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea, TextInput } from "@/components/ui/Field";

interface ProviderFormProps {
  provider?: ProviderConfig;
  onSave: (provider: ProviderConfig) => void;
  onCancel: () => void;
}

function createBlankProvider(): ProviderConfig {
  const createdAt = nowIso();

  return {
    id: "",
    name: "",
    protocol: "openai-compatible",
    baseUrl: "",
    apiKey: "",
    defaultModel: "",
    note: "",
    createdAt,
    updatedAt: createdAt
  };
}

export function ProviderForm({ provider, onSave, onCancel }: ProviderFormProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<ProviderConfig>(provider || createBlankProvider());
  const recommendedModels = useMemo(() => {
    const fromTemplate = providerTemplates.find((template) => template.name === draft.name)?.recommendedModels || [];
    return Array.from(new Set([draft.defaultModel, ...fromTemplate].filter((model): model is string => Boolean(model))));
  }, [draft.defaultModel, draft.name]);

  const applyTemplate = (templateName: string) => {
    const template = providerTemplates.find((item) => item.name === templateName);
    if (!template) {
      return;
    }

    setDraft((current) => ({
      ...current,
      name: template.name,
      protocol: template.protocol,
      baseUrl: template.baseUrl,
      defaultModel: current.defaultModel || template.recommendedModels[0] || ""
    }));
  };

  const changeProtocol = (protocol: ProviderProtocol) => {
    setDraft((current) => ({
      ...current,
      protocol,
      localCli:
        protocol === "local-cli"
          ? current.localCli || {
              agentId: `custom-${current.id || "cli"}`,
              commandCandidates: [""],
              args: [],
              inputMode: "stdin",
              outputFormat: "text",
              capability: "adapted"
            }
          : protocol === "ollama"
            ? current.localCli || {
                agentId: "ollama",
                commandCandidates: ["ollama"],
                detectionPaths: ["~/.ollama"],
                args: [],
                inputMode: "stdin",
                outputFormat: "text",
                capability: "adapted"
              }
          : current.localCli
    }));
  };

  const handleSubmit = () => {
    const timestamp = nowIso();
    onSave({
      ...draft,
      id: draft.id || createId("provider"),
      name: draft.name.trim() || t("unnamedProvider"),
      baseUrl: draft.baseUrl.trim(),
      apiKey: draft.apiKey.trim(),
      defaultModel: draft.defaultModel.trim(),
      note: draft.note.trim(),
      localCli:
        draft.protocol === "local-cli" && draft.localCli
          ? {
              ...draft.localCli,
              agentId: draft.localCli.agentId || `custom-${draft.id || "cli"}`,
              commandCandidates: draft.localCli.commandCandidates.map((command) => command.trim()).filter(Boolean),
              args: draft.localCli.args.map((argument) => argument.trim()).filter(Boolean),
              resultPath: draft.localCli.resultPath?.trim() || undefined,
              capability: draft.localCli.capability || "adapted"
            }
          : draft.localCli,
      updatedAt: timestamp,
      createdAt: draft.createdAt || timestamp
    });
  };

  return (
    <div className="space-y-4">
      {draft.protocol !== "local-cli" && draft.protocol !== "ollama" ? (
        <Field label={t("providerTemplate")} hint={t("optional")}>
          <Select defaultValue="" onChange={(event) => applyTemplate(event.target.value)}>
            <option value="">{t("manualConfig")}</option>
            {providerTemplates.map((template) => (
              <option key={template.name} value={template.name}>
                {template.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("configName")}>
          <TextInput
            value={draft.name}
            placeholder={t("configNamePlaceholder")}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
        </Field>
        <Field label={t("protocolType")}>
          <Select
            value={draft.protocol}
            disabled={draft.localCli?.builtIn}
            onChange={(event) => changeProtocol(event.target.value as ProviderProtocol)}
          >
            <option value="openai-compatible">{t("protocolOpenAI")}</option>
            <option value="anthropic">{t("protocolAnthropic")}</option>
            <option value="local-cli">本地 CLI</option>
            <option value="ollama">Ollama 本地模型</option>
          </Select>
        </Field>
      </div>

      {draft.protocol === "local-cli" && draft.localCli ? (
        <>
          <Field label="CLI 命令" hint={draft.localCli.builtIn ? "内置适配器使用固定命令候选" : "可以填写命令名或完整路径"}>
            <TextInput
              value={draft.localCli.commandCandidates[0] || ""}
              placeholder="/完整路径/codebuddy 或 codebuddy"
              disabled={draft.localCli.builtIn}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  localCli: current.localCli
                    ? { ...current.localCli, commandCandidates: [event.target.value] }
                    : current.localCli
                }))
              }
            />
          </Field>

          {!draft.localCli.builtIn ? (
            <>
              <Field label="命令参数" hint="每行一个参数；支持 {prompt}、{systemPrompt}、{model}、{cwd}">
                <Textarea
                  value={draft.localCli.args.join("\n")}
                  placeholder={"-p\n--output-format\njson"}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      localCli: current.localCli
                        ? { ...current.localCli, args: event.target.value.split(/\r?\n/) }
                        : current.localCli
                    }))
                  }
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="提示词输入方式">
                  <Select
                    value={draft.localCli.inputMode}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        localCli: current.localCli
                          ? { ...current.localCli, inputMode: event.target.value as LocalCliInputMode }
                          : current.localCli
                      }))
                    }
                  >
                    <option value="stdin">标准输入 stdin</option>
                    <option value="argument">命令参数</option>
                  </Select>
                </Field>
                <Field label="输出格式">
                  <Select
                    value={draft.localCli.outputFormat}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        localCli: current.localCli
                          ? { ...current.localCli, outputFormat: event.target.value as LocalCliOutputFormat }
                          : current.localCli
                      }))
                    }
                  >
                    <option value="text">纯文本</option>
                    <option value="json">JSON</option>
                    <option value="jsonl">流式 JSONL</option>
                  </Select>
                </Field>
              </div>

              {draft.localCli.outputFormat !== "text" ? (
                <Field label="结果字段" hint="可选，例如 result、response 或 message.content">
                  <TextInput
                    value={draft.localCli.resultPath || ""}
                    placeholder="result"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        localCli: current.localCli
                          ? { ...current.localCli, resultPath: event.target.value }
                          : current.localCli
                      }))
                    }
                  />
                </Field>
              ) : null}
            </>
          ) : null}

          <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            自定义 CLI 会在本机直接启动。应用不会使用 shell，但该程序本身仍可能读写文件或联网，请只配置你信任的官方或开源 CLI。
          </div>
        </>
      ) : draft.protocol === "ollama" ? (
        <>
          <Field label="Ollama 地址" hint="默认 http://127.0.0.1:11434">
            <TextInput
              value={draft.baseUrl}
              placeholder="http://127.0.0.1:11434"
              onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))}
            />
          </Field>
          <Field label={t("defaultModel")} hint="可从模型配置页的本地模型列表中选择">
            <TextInput
              value={draft.defaultModel}
              placeholder="llama3.2:latest"
              onChange={(event) => setDraft((current) => ({ ...current, defaultModel: event.target.value }))}
            />
          </Field>
          <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
            Ollama 模型和对话都在本机运行。请先启动 Ollama，并确认已经下载模型。
          </div>
        </>
      ) : (
        <>
          <Field label="Base URL">
            <TextInput
              value={draft.baseUrl}
              placeholder="https://api.example.com/v1"
              onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))}
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="API Key" hint={t("apiKeyLocalOnly")}>
              <TextInput
                type="password"
                value={draft.apiKey}
                placeholder="sk-..."
                autoComplete="off"
                onChange={(event) => setDraft((current) => ({ ...current, apiKey: event.target.value }))}
              />
            </Field>
            <Field label={t("defaultModel")} hint={t("anyModelNameHint")}>
              <TextInput
                value={draft.defaultModel}
                list="provider-models"
                placeholder="qwen-plus"
                onChange={(event) => setDraft((current) => ({ ...current, defaultModel: event.target.value }))}
              />
              <datalist id="provider-models">
                {recommendedModels.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            </Field>
          </div>
        </>
      )}

      {draft.protocol === "local-cli" ? (
        <Field label={t("defaultModel")} hint="可选；留空时使用该 CLI 当前默认模型">
          <TextInput
            value={draft.defaultModel}
            placeholder="留空使用 CLI 默认模型"
            onChange={(event) => setDraft((current) => ({ ...current, defaultModel: event.target.value }))}
          />
        </Field>
      ) : null}

      <Field label={t("note")} hint={t("optional")}>
        <Textarea
          value={draft.note}
          placeholder={t("notePlaceholder")}
          onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
        />
      </Field>

      {draft.protocol !== "local-cli" && draft.protocol !== "ollama" ? (
        <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          {t("apiKeySafety")}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="button" variant="primary" onClick={handleSubmit}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
