"use client";

import { ImagePlus, X } from "lucide-react";
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedProvider = providers.find((provider) => provider.id === draft.providerId);
  const modelOptions = useMemo(() => {
    const templateModels =
      providerTemplates.find(
        (template) => template.name === selectedProvider?.name || template.baseUrl === selectedProvider?.baseUrl
      )?.recommendedModels || [];

    return Array.from(
      new Set([draft.model, selectedProvider?.defaultModel, ...templateModels].filter((model): model is string => Boolean(model)))
    );
  }, [draft.model, selectedProvider]);

  const handleProviderChange = (providerId: string) => {
    const provider = providers.find((item) => item.id === providerId);
    setDraft((current) => ({
      ...current,
      providerId,
      model: current.model || provider?.defaultModel || ""
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
      model: draft.model.trim(),
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

      <Field label={t("identitySetting")}>
        <Textarea
          value={draft.systemPrompt}
          placeholder={t("identityPlaceholder")}
          onChange={(event) => setDraft((current) => ({ ...current, systemPrompt: event.target.value }))}
        />
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
            disabled={providers.length === 0}
          >
            <option value="">{providers.length === 0 ? t("noProviderConfigShort") : t("noProviderOption")}</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("defaultModel")} hint={t("defaultModelHint")}>
          <TextInput
            value={draft.model}
            list="role-models"
            placeholder={selectedProvider?.defaultModel || t("anyModelPlaceholder")}
            onChange={(event) => setDraft((current) => ({ ...current, model: event.target.value }))}
          />
          <datalist id="role-models">
            {modelOptions.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
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
