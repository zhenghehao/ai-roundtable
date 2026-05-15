"use client";

import { useMemo, useState } from "react";
import { providerTemplates } from "@/lib/defaults";
import { useI18n } from "@/lib/i18n-context";
import type { ProviderConfig, ProviderProtocol } from "@/lib/types";
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
      updatedAt: timestamp,
      createdAt: draft.createdAt || timestamp
    });
  };

  return (
    <div className="space-y-4">
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
            onChange={(event) =>
              setDraft((current) => ({ ...current, protocol: event.target.value as ProviderProtocol }))
            }
          >
            <option value="openai-compatible">{t("protocolOpenAI")}</option>
            <option value="anthropic">{t("protocolAnthropic")}</option>
          </Select>
        </Field>
      </div>

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

      <Field label={t("note")} hint={t("optional")}>
        <Textarea
          value={draft.note}
          placeholder={t("notePlaceholder")}
          onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
        />
      </Field>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
        {t("apiKeySafety")}
      </div>

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
