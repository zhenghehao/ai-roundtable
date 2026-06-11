"use client";

import { FileText, ImagePlus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { providerTemplates } from "@/lib/defaults";
import { useI18n } from "@/lib/i18n-context";
import type { AgentRole, ProviderConfig } from "@/lib/types";
import { createId, nowIso } from "@/lib/utils";
import { RoleAvatar } from "@/components/roles/RoleAvatar";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea, TextInput } from "@/components/ui/Field";

interface RoleFormProps {
  role?: AgentRole;
  providers: ProviderConfig[];
  onSave: (role: AgentRole) => void;
  onCancel: () => void;
}

function createBlankRole(): AgentRole {
  const timestamp = nowIso();

  return {
    id: "",
    name: "",
    avatarColor: "#0f766e",
    systemPrompt: "",
    speakingStyle: "",
    providerId: "",
    model: "",
    enabled: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("avatarReadFailed"));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("identityFileReadFailed"));
    reader.readAsText(file, "utf-8");
  });
}

function isMarkdownIdentityFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".md") || name.endsWith(".markdown") || file.type === "text/markdown" || file.type === "text/plain" || file.type === "";
}

function filenameToRoleName(fileName: string) {
  return fileName.replace(/\.(md|markdown|txt)$/i, "").trim();
}

function normalizeBaseUrl(value?: string) {
  return (value || "").trim().replace(/\/+$/, "").toLowerCase();
}

function getModelOptionsForProvider(provider: ProviderConfig | undefined, providers: ProviderConfig[]) {
  if (!provider) {
    return [];
  }

  const providerBaseUrl = normalizeBaseUrl(provider.baseUrl);
  const templateModels =
    providerTemplates.find(
      (template) => template.name === provider.name || normalizeBaseUrl(template.baseUrl) === providerBaseUrl
    )?.recommendedModels || [];
  const configuredModels = providers
    .filter((item) => item.id === provider.id || item.name === provider.name || normalizeBaseUrl(item.baseUrl) === providerBaseUrl)
    .map((item) => item.defaultModel.trim())
    .filter(Boolean);

  return Array.from(new Set([...configuredModels, ...templateModels]));
}

async function cropImageToSquare(file: File) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = new Image();
  image.decoding = "async";

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("avatarOpenFailed"));
    image.src = dataUrl;
  });

  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 320;

  const context = canvas.getContext("2d");
  if (!context) {
    return dataUrl;
  }

  context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 320, 320);
  return canvas.toDataURL("image/jpeg", 0.88);
}

export function RoleForm({ role, providers, onSave, onCancel }: RoleFormProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<AgentRole>(role || createBlankRole());
  const [identityFileName, setIdentityFileName] = useState(role?.identityFileName || "");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const identityFileInputRef = useRef<HTMLInputElement | null>(null);
  const availableProviders = providers.filter(
    (provider) => provider.protocol !== "local-cli" || provider.localCli?.capability === "adapted"
  );
  const selectedProvider = availableProviders.find((provider) => provider.id === draft.providerId);
  const modelOptions = useMemo(
    () => getModelOptionsForProvider(selectedProvider, availableProviders),
    [availableProviders, selectedProvider]
  );
  const selectedModelValue = selectedProvider && modelOptions.includes(draft.model) ? draft.model : modelOptions[0] || "";

  const handleProviderChange = (providerId: string) => {
    const provider = availableProviders.find((item) => item.id === providerId);
    const nextModelOptions = getModelOptionsForProvider(provider, availableProviders);
    setDraft((current) => ({
      ...current,
      providerId,
      model: nextModelOptions[0] || provider?.defaultModel || ""
    }));
  };

  const handleAvatarFile = async (file?: File) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      window.alert(t("alertImageOnly"));
      return;
    }

    try {
      const avatarImage = await cropImageToSquare(file);
      setDraft((current) => ({ ...current, avatarImage }));
    } catch (error) {
      const message =
        error instanceof Error && (error.message === "avatarReadFailed" || error.message === "avatarOpenFailed")
          ? t(error.message)
          : t("avatarProcessFailed");
      window.alert(message);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleIdentityFile = async (file?: File) => {
    if (!file) {
      return;
    }

    if (!isMarkdownIdentityFile(file)) {
      window.alert(t("alertMarkdownOnly"));
      return;
    }

    try {
      const content = await readFileAsText(file);
      const roleNameFromFile = filenameToRoleName(file.name);
      const timestamp = nowIso();
      setDraft((current) => ({
        ...current,
        name: current.name.trim() ? current.name : roleNameFromFile || current.name,
        identityFileName: file.name,
        identityFileContent: content,
        identityFileUpdatedAt: timestamp
      }));
      setIdentityFileName(file.name);
    } catch {
      window.alert(t("identityFileReadFailed"));
    } finally {
      if (identityFileInputRef.current) {
        identityFileInputRef.current.value = "";
      }
    }
  };

  const removeIdentityFile = () => {
    setDraft((current) => ({
      ...current,
      identityFileName: undefined,
      identityFileContent: undefined,
      identityFileUpdatedAt: undefined
    }));
    setIdentityFileName("");
  };

  const handleSubmit = () => {
    const timestamp = nowIso();
    onSave({
      ...draft,
      id: draft.id || createId("role"),
      name: draft.name.trim() || t("unnamedRole"),
      systemPrompt:
        draft.systemPrompt.trim() ||
        t("defaultRolePrompt"),
      speakingStyle: draft.speakingStyle.trim() || t("defaultSpeakingStyle"),
      identityFileName: draft.identityFileName,
      identityFileContent: draft.identityFileContent?.trim() || undefined,
      identityFileUpdatedAt: draft.identityFileContent?.trim() ? draft.identityFileUpdatedAt || timestamp : undefined,
      model: selectedProvider
        ? modelOptions.includes(draft.model.trim())
          ? draft.model.trim()
          : modelOptions[0] || selectedProvider.defaultModel || ""
        : draft.model.trim(),
      updatedAt: timestamp,
      createdAt: draft.createdAt || timestamp
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_180px]">
        <div className="space-y-4">
          <Field label={t("roleName")}>
            <TextInput
              value={draft.name}
              placeholder={t("roleNamePlaceholder")}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field label={t("avatarColor")} hint={t("avatarColorHint")}>
            <TextInput
              type="color"
              value={draft.avatarColor}
              onChange={(event) => setDraft((current) => ({ ...current, avatarColor: event.target.value }))}
              className="h-10 p-1"
            />
          </Field>
        </div>

        <Field label={t("localAvatar")} hint={t("localAvatarHint")}>
          <div className="space-y-3">
            <button
              type="button"
              className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-md border border-dashed border-gray-300 bg-gray-50 text-gray-400 transition hover:border-teal-300 hover:bg-teal-50"
              onClick={() => fileInputRef.current?.click()}
              title={t("chooseLocalAvatar")}
            >
              {draft.avatarImage ? (
                <img src={draft.avatarImage} alt={t("avatarPreview")} className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-7 w-7" />
              )}
            </button>
            <div className="flex items-center gap-2">
              <RoleAvatar role={draft} size="sm" />
              <span className="text-xs text-gray-500">{t("avatarRoundHint")}</span>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="h-4 w-4" />
                {t("chooseImage")}
              </Button>
              {draft.avatarImage ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => setDraft((current) => ({ ...current, avatarImage: undefined }))}>
                  <X className="h-4 w-4" />
                  {t("remove")}
                </Button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleAvatarFile(event.target.files?.[0])}
            />
          </div>
        </Field>
      </div>

      <Field label={t("identityFile")} hint={t("identityFileHint")}>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => identityFileInputRef.current?.click()}>
              <FileText className="h-4 w-4" />
              {t("uploadIdentityFile")}
            </Button>
            <span className="text-xs text-slate-500">
              {identityFileName ? t("identityFileLoaded", { name: identityFileName }) : t("identityFile")}
            </span>
            {draft.identityFileContent ? (
              <Button type="button" size="sm" variant="ghost" onClick={removeIdentityFile}>
                <X className="h-4 w-4" />
                {t("removeIdentityFile")}
              </Button>
            ) : null}
          </div>
          <input
            ref={identityFileInputRef}
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            className="hidden"
            onChange={(event) => void handleIdentityFile(event.target.files?.[0])}
          />
          {draft.identityFileContent ? (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3">
              <div className="flex items-start gap-2 text-xs text-indigo-900">
                <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold">{t("identityFileBoundTitle")}</div>
                  <div className="mt-1 leading-5 text-indigo-700">{t("identityFileBoundDesc")}</div>
                </div>
              </div>
              <pre className="mt-3 max-h-28 overflow-y-auto whitespace-pre-wrap rounded-xl bg-white/80 p-3 text-xs leading-5 text-slate-600 scrollbar-thin">
                {draft.identityFileContent.slice(0, 1200)}
                {draft.identityFileContent.length > 1200 ? "\n..." : ""}
              </pre>
            </div>
          ) : null}
        </div>
      </Field>

      <Field label={t("identitySetting")} hint={t("identitySupplementHint")}>
        <div className="space-y-2">
          <Textarea
            className="min-h-36"
            value={draft.systemPrompt}
            placeholder={t("identityPlaceholder")}
            onChange={(event) => setDraft((current) => ({ ...current, systemPrompt: event.target.value }))}
          />
        </div>
      </Field>

      <Field label={t("speakingStyle")}>
        <Textarea
          value={draft.speakingStyle}
          placeholder={t("speakingStylePlaceholder")}
          onChange={(event) => setDraft((current) => ({ ...current, speakingStyle: event.target.value }))}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("defaultProviderConfig")}>
          <Select
            value={draft.providerId}
            onChange={(event) => handleProviderChange(event.target.value)}
            disabled={availableProviders.length === 0}
          >
            <option value="">{availableProviders.length === 0 ? t("noProviderConfigShort") : t("noProviderOption")}</option>
            {availableProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("defaultModel")} hint={t("defaultModelHint")}>
          <Select
            value={selectedModelValue}
            onChange={(event) => setDraft((current) => ({ ...current, model: event.target.value }))}
            disabled={!selectedProvider || modelOptions.length === 0}
          >
            {modelOptions.length === 0 ? (
              <option value="">{selectedProvider ? t("useProviderDefault") : t("noProviderOption")}</option>
            ) : null}
            {modelOptions.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <label className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))}
          className="h-4 w-4 accent-teal-600"
        />
        {t("enableRole")}
      </label>

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
